import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getAdminClient } from "@/lib/supabase/admin";
import { runIngestAgent } from "@/lib/agents/ingest-agent";
import { logger } from "@/lib/logger";
import { badRequest, notFound } from "@/lib/errors";

// Allows super_admin to re-trigger ingestion for a document.
// Useful after a pipeline bug fix.
export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request, "super_admin");
  if (error) return error;

  const { documentId } = await request.json() as { documentId?: string };
  if (!documentId) return badRequest("documentId is required");

  const admin = getAdminClient();
  const { data: doc } = await admin.from("documents").select("id, name, status").eq("id", documentId).single();
  if (!doc) return notFound("Document");

  // Reset status to queued
  await admin.from("documents").update({ status: "queued", error_msg: null }).eq("id", documentId);
  // Delete existing chunks
  await admin.from("document_chunks").delete().eq("document_id", documentId);

  logger.info("ingest_agent", `Re-indexing triggered for ${doc.name}`, { documentId }, user!.id);

  // Fire async
  runIngestAgent(documentId, user!.id).catch((e) =>
    logger.error("ingest_agent", "Re-index failed", { documentId, error: String(e) }, user!.id)
  );

  return NextResponse.json({ ok: true, documentId, message: `Re-indexing started for "${doc.name}"` });
}
