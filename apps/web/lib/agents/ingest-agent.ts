import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit";
import { extractText } from "@/lib/extractor";
import { scanAndMaskPII } from "@/lib/pii";
import { chunkText } from "@/lib/chunker";
import { embedText } from "@/lib/embedder";
import { tryIndexChunk } from "@/lib/search/elasticsearch";

interface DocRecord {
  id: string;
  name: string;
  original_name: string;
  file_type: string;
  storage_path: string;
  department_id: string;
  version: number;
  uploaded_by: string;
}

async function getDocument(docId: string): Promise<DocRecord> {
  const { data, error } = await getAdminClient()
    .from("documents")
    .select("id, name, original_name, file_type, storage_path, department_id, version, uploaded_by")
    .eq("id", docId)
    .single();
  if (error || !data) throw new Error(`Document not found: ${docId}`);
  return data as DocRecord;
}

async function setStatus(docId: string, status: string, errorMsg?: string): Promise<void> {
  await getAdminClient()
    .from("documents")
    .update({ status, error_msg: errorMsg ?? null })
    .eq("id", docId);
}

async function downloadFile(storagePath: string): Promise<Buffer> {
  const { data, error } = await getAdminClient()
    .storage
    .from("documents")
    .download(storagePath);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

// ── Main pipeline ─────────────────────────────────────────────────────────────
export async function runIngestAgent(documentId: string, userId: string): Promise<void> {
  const pipelineStart = Date.now();

  logger.ingest({ documentId, step: "started", durationMs: 0, success: true, userId });

  try {
    // 1 — Mark processing
    await setStatus(documentId, "processing");

    // 2 — Load document record
    const doc = await getDocument(documentId);

    // 3 — Download file from Supabase Storage
    let t = Date.now();
    const buffer = await downloadFile(doc.storage_path);
    logger.ingest({ documentId, step: "download", durationMs: Date.now() - t, success: true,
      detail: `${buffer.byteLength} bytes`, userId });

    // 4 — Extract text
    t = Date.now();
    const { text, pageCount, method } = await extractText(buffer, doc.file_type, doc.original_name);
    logger.ingest({ documentId, step: "extract", durationMs: Date.now() - t, success: true,
      detail: `method=${method} chars=${text.length} pages=${pageCount}`, userId });

    // 5 — PII scan + mask (mandatory before any storage)
    t = Date.now();
    const { maskedText, hasPII, detectedTypes } = scanAndMaskPII(text);
    logger.ingest({ documentId, step: "pii_scan", durationMs: Date.now() - t, success: true,
      detail: `hasPII=${hasPII} types=${detectedTypes.join(",")}`, userId });

    // 6 — Chunk
    t = Date.now();
    const chunks = chunkText(maskedText);
    logger.ingest({ documentId, step: "chunk", durationMs: Date.now() - t, success: true,
      detail: `${chunks.length} chunks`, userId });

    if (chunks.length === 0) throw new Error("No text could be extracted from this document");

    // 7 — Embed + upsert each chunk to pgvector + ES
    t = Date.now();
    const admin = getAdminClient();

    for (const chunk of chunks) {
      // 7a — Generate embedding via Ollama
      const { embedding } = await embedText(chunk.content);

      // 7b — Upsert into document_chunks (pgvector)
      // Pass embedding as vector literal string — required for pgvector via PostgREST
      const vectorLiteral = `[${embedding.join(",")}]`;
      const { error: upsertErr } = await admin.from("document_chunks").upsert({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content:     chunk.content,
        embedding:   vectorLiteral,
        page_number: chunk.pageNumber ?? null,
        metadata:    { method, hasPII, chunkIndex: chunk.chunkIndex },
      }, { onConflict: "document_id,chunk_index" });

      if (upsertErr) {
        throw new Error(`Chunk upsert failed (chunk ${chunk.chunkIndex}): ${upsertErr.message}`);
      }

      // Stable ID for ES: use the auto-generated UUID query after insert
      const { data: inserted } = await admin.from("document_chunks")
        .select("id")
        .eq("document_id", documentId)
        .eq("chunk_index", chunk.chunkIndex)
        .single();

      const chunkId = inserted?.id ?? `${documentId}_${chunk.chunkIndex}`;

      // 7c — Index to Elasticsearch (non-fatal if ES is down)
      await tryIndexChunk({
        chunkId,
        documentId,
        departmentId: doc.department_id,
        content:      chunk.content,
        pageNumber:   chunk.pageNumber ?? null,
        docName:      doc.name,
        docType:      doc.file_type,
        version:      doc.version,
        createdAt:    new Date().toISOString(),
      });
    }

    logger.ingest({ documentId, step: "embed_upsert", durationMs: Date.now() - t, success: true,
      detail: `${chunks.length} chunks embedded + stored`, userId });

    // 8 — Update document: status=indexed, page_count
    await admin.from("documents").update({
      status:     "indexed",
      page_count: pageCount,
      error_msg:  null,
    }).eq("id", documentId);

    const totalMs = Date.now() - pipelineStart;

    logger.agent({
      agentName:     "ingest_agent",
      userId,
      inputSummary:  `${doc.name} (${doc.file_type}, ${buffer.byteLength} bytes)`,
      outputSummary: `${chunks.length} chunks indexed, ${pageCount} pages, ${hasPII ? "PII masked" : "no PII"}`,
      durationMs:    totalMs,
      success:       true,
    });

    auditLog({
      userId,
      action:       "document_indexed",
      resourceType: "document",
      resourceId:   documentId,
      metadata:     { chunks: chunks.length, pageCount, hasPII, method },
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await setStatus(documentId, "failed", errorMsg);

    logger.ingest({ documentId, step: "failed", durationMs: Date.now() - pipelineStart,
      success: false, detail: errorMsg, userId });

    logger.agent({
      agentName:     "ingest_agent",
      userId,
      inputSummary:  `doc: ${documentId}`,
      outputSummary: `Failed: ${errorMsg}`,
      durationMs:    Date.now() - pipelineStart,
      success:       false,
      error:         errorMsg,
    });
  }
}
