import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { runIngestAgent } from "@/lib/agents/ingest-agent";
import { logger } from "@/lib/logger";

// Localhost-only endpoint called by scripts/process-queue.mjs.
// Accepts a document ID, verifies it is queued, and fires the ingest pipeline.
export async function POST(request: NextRequest) {
  // Only allow calls from the loopback interface.
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim() ?? "";
  const isLocal = ["127.0.0.1", "::1", "localhost", ""].includes(ip);
  if (!isLocal) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as { documentId?: string };
  if (!body.documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("id, uploaded_by, status")
    .eq("id", body.documentId)
    .single() as unknown as {
      data: { id: string; uploaded_by: string; status: string } | null;
    };

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.status !== "queued") {
    return NextResponse.json({ ok: true, skipped: true, status: doc.status });
  }

  logger.info("ingest_agent", "Queue processor triggered ingest", { documentId: doc.id });

  // Fire-and-forget — response returns immediately; ingest runs in background.
  runIngestAgent(doc.id, doc.uploaded_by).catch((err) =>
    logger.error("ingest_agent", "Triggered ingest failed", {
      documentId: doc.id, error: String(err),
    })
  );

  return NextResponse.json({ ok: true, documentId: doc.id });
}

export async function generateStaticParams() { return []; }
