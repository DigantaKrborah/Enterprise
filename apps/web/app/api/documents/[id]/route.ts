import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit";
import { forbidden, notFound, serverError } from "@/lib/errors";
import { deleteDocumentChunks } from "@/lib/search/elasticsearch";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const start = Date.now();
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const supabase = createClient();
  const { data, error: dbErr } = await supabase
    .from("documents")
    .select(`
      id, name, original_name, department_id, file_type, version, status,
      error_msg, size_bytes, page_count, created_at, parent_id,
      departments(id, name),
      users!documents_uploaded_by_fkey(id, full_name, email)
    `)
    .eq("id", params.id)
    .eq("is_deleted", false)
    .single();

  if (dbErr || !data) return notFound("Document");

  // Check department access
  if (user!.role !== "super_admin" && data.department_id !== user!.departmentId) {
    return forbidden();
  }

  auditLog({ userId: user!.id, action: "view_document", resourceType: "document", resourceId: params.id });

  logger.api({ method: "GET", endpoint: `/api/documents/${params.id}`, statusCode: 200,
    latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const start = Date.now();
  // Only dept_admin+ can delete
  const { user, error } = await requireAuth(request, "dept_admin");
  if (error) return error;

  const supabase = createClient();
  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("id, department_id, storage_path")
    .eq("id", params.id)
    .eq("is_deleted", false)
    .single();

  if (fetchErr || !doc) return notFound("Document");

  // dept_admin can only delete from their dept
  if (user!.role !== "super_admin" && doc.department_id !== user!.departmentId) {
    return forbidden();
  }

  const admin = getAdminClient();

  // Soft delete the document record
  const { error: delErr } = await admin
    .from("documents")
    .update({ is_deleted: true })
    .eq("id", params.id);

  if (delErr) {
    logger.error("api", "Document soft-delete failed", { error: delErr.message }, user!.id);
    return serverError();
  }

  // Delete chunks from pgvector
  await admin.from("document_chunks").delete().eq("document_id", params.id);

  // Delete chunks from Elasticsearch (non-fatal)
  deleteDocumentChunks(params.id).catch((err) =>
    logger.warn("api", "ES chunk delete failed (non-fatal)", { error: String(err) })
  );

  auditLog({
    userId: user!.id, action: "delete_document",
    resourceType: "document", resourceId: params.id,
  });

  logger.info("api", "Document soft-deleted", { documentId: params.id }, user!.id);
  logger.api({ method: "DELETE", endpoint: `/api/documents/${params.id}`, statusCode: 200,
    latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ ok: true });
}

export async function generateStaticParams() { return []; }
