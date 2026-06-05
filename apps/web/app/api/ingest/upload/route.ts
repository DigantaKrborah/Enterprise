import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit";
import { uploadRateLimit } from "@/lib/rate-limit";
import { resolveFileType } from "@/lib/extractor";
import { runIngestAgent } from "@/lib/agents/ingest-agent";
import { badRequest, rateLimited, serverError } from "@/lib/errors";

const MAX_FILE_SIZE = 52_428_800; // 50 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png", "image/jpeg", "image/tiff",
]);

export async function POST(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request, "employee");
  if (error) return error;

  if (!uploadRateLimit(user!.id)) return rateLimited();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("Invalid multipart form data");
  }

  const file = formData.get("file") as File | null;
  const departmentId = (formData.get("departmentId") as string | null) ?? user!.departmentId;

  if (!file) return badRequest("file is required");
  if (!departmentId) return badRequest("departmentId is required");
  if (!ALLOWED_MIME.has(file.type)) return badRequest(`Unsupported file type: ${file.type}`);
  if (file.size > MAX_FILE_SIZE) return badRequest("File exceeds 50 MB limit");

  // dept_admin can only upload to their own dept
  if (user!.role !== "super_admin" && user!.departmentId !== departmentId) {
    return badRequest("You can only upload to your own department");
  }

  const admin = getAdminClient();

  // Determine version: check for existing doc with same name in same dept
  const { data: existing } = await admin
    .from("documents")
    .select("id, version")
    .eq("department_id", departmentId)
    .eq("original_name", file.name)
    .eq("is_deleted", false)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = existing ? existing.version + 1 : 1;
  const parentId = existing ? existing.id : null;

  const docId = crypto.randomUUID();
  const fileType = resolveFileType(file.type, file.name);
  const storagePath = `${departmentId}/${docId}/${file.name}`;

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: storageErr } = await admin.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (storageErr) {
    logger.error("ingest_agent", "Storage upload failed", { error: storageErr.message }, user!.id);
    return serverError("File storage failed");
  }

  // Create document record (status: queued)
  const { error: dbErr } = await admin.from("documents").insert({
    id:            docId,
    name:          file.name.replace(/\.[^.]+$/, ""), // strip extension for display
    original_name: file.name,
    department_id: departmentId,
    uploaded_by:   user!.id,
    file_type:     fileType,
    storage_path:  storagePath,
    version,
    parent_id:     parentId,
    status:        "queued",
    size_bytes:    file.size,
  });

  if (dbErr) {
    logger.error("ingest_agent", "Document record creation failed", { error: dbErr.message }, user!.id);
    // Clean up orphaned storage file
    await admin.storage.from("documents").remove([storagePath]);
    return serverError("Failed to create document record");
  }

  logger.info("ingest_agent", "Document queued for ingestion", {
    docId, fileName: file.name, fileType, version, sizeBytes: file.size,
  }, user!.id);

  auditLog({
    userId: user!.id, action: "document_upload",
    resourceType: "document", resourceId: docId,
    metadata: { fileName: file.name, fileType, version, sizeBytes: file.size },
  });

  // Fire-and-forget ingestion — do not await (Next.js Node runtime keeps process alive)
  runIngestAgent(docId, user!.id).catch((err) =>
    logger.error("ingest_agent", "Unhandled ingest error", { docId, error: String(err) }, user!.id)
  );

  logger.api({ method: "POST", endpoint: "/api/ingest/upload", statusCode: 201,
    latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ ok: true, documentId: docId, version, status: "queued" }, { status: 201 });
}
