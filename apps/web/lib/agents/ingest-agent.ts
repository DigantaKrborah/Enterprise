import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit";
import { extractText } from "@/lib/extractor";
import { scanAndMaskPII } from "@/lib/pii";
import { chunkText } from "@/lib/chunker";
import { embedText } from "@/lib/embedder";
import { tryIndexChunk, deleteDocumentChunks } from "@/lib/search/elasticsearch";

interface DocRecord {
  id:            string;
  name:          string;
  original_name: string;
  file_type:     string;
  storage_path:  string;
  department_id: string;
  version:       number;
  uploaded_by:   string;
  parent_id:     string | null;
}

const CHUNK_MAX_RETRIES = 2;
const CHUNK_RETRY_BASE_MS = 1_000;

async function getDocument(docId: string): Promise<DocRecord> {
  const { data, error } = await getAdminClient()
    .from("documents")
    .select("id, name, original_name, file_type, storage_path, department_id, version, uploaded_by, parent_id")
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

// Embed one chunk and upsert it into pgvector + Elasticsearch.
// Retries up to CHUNK_MAX_RETRIES times with exponential back-off.
// Returns true on success, false after exhausting retries (caller continues).
async function embedAndStoreChunk(
  chunk:        { content: string; chunkIndex: number; pageNumber?: number | null },
  documentId:   string,
  doc:          DocRecord,
  method:       string,
  hasPII:       boolean,
): Promise<boolean> {
  const admin = getAdminClient();

  for (let attempt = 0; attempt <= CHUNK_MAX_RETRIES; attempt++) {
    try {
      const { embedding } = await embedText(chunk.content);
      const vectorLiteral = `[${embedding.join(",")}]`;

      const { error: upsertErr } = await admin.from("document_chunks").upsert(
        {
          document_id: documentId,
          chunk_index: chunk.chunkIndex,
          content:     chunk.content,
          embedding:   vectorLiteral,
          page_number: chunk.pageNumber ?? null,
          metadata:    { method, hasPII, chunkIndex: chunk.chunkIndex },
        },
        { onConflict: "document_id,chunk_index" },
      );

      if (upsertErr) throw new Error(upsertErr.message);

      // Fetch the stable UUID for ES indexing.
      const { data: inserted } = await admin
        .from("document_chunks")
        .select("id")
        .eq("document_id", documentId)
        .eq("chunk_index", chunk.chunkIndex)
        .single();

      const chunkId = inserted?.id ?? `${documentId}_${chunk.chunkIndex}`;

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

      return true;
    } catch (err) {
      if (attempt === CHUNK_MAX_RETRIES) {
        logger.warn("ingest_agent", `Chunk ${chunk.chunkIndex} failed after ${CHUNK_MAX_RETRIES + 1} attempts — skipping`, {
          documentId, error: String(err),
        });
        return false;
      }
      // Exponential back-off before retry.
      await new Promise((r) => setTimeout(r, CHUNK_RETRY_BASE_MS * Math.pow(2, attempt)));
    }
  }
  return false;
}

// When a new document version is successfully indexed, retire the previous
// version: remove its vector chunks (so retrieval only finds the latest)
// and mark its status as "superseded".
async function supersedePreviousVersion(parentId: string, userId: string): Promise<void> {
  const admin = getAdminClient();
  try {
    // Delete pgvector chunks for the old version.
    await admin.from("document_chunks").delete().eq("document_id", parentId);

    // Delete Elasticsearch entries for the old version.
    await deleteDocumentChunks(parentId);

    // Mark the old document record as superseded.
    await admin.from("documents")
      .update({ status: "superseded" })
      .eq("id", parentId);

    logger.info("ingest_agent", "Previous version superseded", { parentId, userId });
  } catch (err) {
    // Non-fatal: log and continue. The new version is still valid.
    logger.warn("ingest_agent", "Failed to supersede previous version", {
      parentId, error: String(err), userId,
    });
  }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────
export async function runIngestAgent(documentId: string, userId: string): Promise<void> {
  const pipelineStart = Date.now();
  logger.ingest({ documentId, step: "started", durationMs: 0, success: true, userId });

  try {
    await setStatus(documentId, "processing");

    const doc = await getDocument(documentId);

    // ── Download ────────────────────────────────────────────────────────────
    let t = Date.now();
    const buffer = await downloadFile(doc.storage_path);
    logger.ingest({ documentId, step: "download", durationMs: Date.now() - t, success: true,
      detail: `${buffer.byteLength} bytes`, userId });

    // ── Extract text ────────────────────────────────────────────────────────
    t = Date.now();
    const { text, pageCount, method } = await extractText(buffer, doc.file_type, doc.original_name);
    logger.ingest({ documentId, step: "extract", durationMs: Date.now() - t, success: true,
      detail: `method=${method} chars=${text.length} pages=${pageCount}`, userId });

    // ── PII scan + mask (mandatory before any storage or LLM call) ──────────
    t = Date.now();
    const { maskedText, hasPII, detectedTypes } = scanAndMaskPII(text);
    logger.ingest({ documentId, step: "pii_scan", durationMs: Date.now() - t, success: true,
      detail: `hasPII=${hasPII} types=${detectedTypes.join(",")}`, userId });

    // ── Chunk ───────────────────────────────────────────────────────────────
    t = Date.now();
    const chunks = chunkText(maskedText);
    logger.ingest({ documentId, step: "chunk", durationMs: Date.now() - t, success: true,
      detail: `${chunks.length} chunks`, userId });

    if (chunks.length === 0) throw new Error("No text could be extracted from this document");

    // ── Embed + store each chunk ────────────────────────────────────────────
    t = Date.now();
    let storedCount = 0;
    let failedCount = 0;

    for (const chunk of chunks) {
      const ok = await embedAndStoreChunk(chunk, documentId, doc, method, hasPII);
      if (ok) storedCount++; else failedCount++;
    }

    // Abort only if every single chunk failed — a partial index is still useful.
    if (storedCount === 0) {
      throw new Error(`All ${chunks.length} chunks failed to embed/store`);
    }

    if (failedCount > 0) {
      logger.warn("ingest_agent", `${failedCount}/${chunks.length} chunks skipped due to errors`, {
        documentId, userId,
      });
    }

    logger.ingest({ documentId, step: "embed_upsert", durationMs: Date.now() - t, success: true,
      detail: `${storedCount}/${chunks.length} chunks stored`, userId });

    // ── Mark indexed ────────────────────────────────────────────────────────
    await getAdminClient().from("documents").update({
      status:     "indexed",
      page_count: pageCount,
      error_msg:  null,
    }).eq("id", documentId);

    // ── Supersede the previous version (if this is a versioned re-upload) ──
    if (doc.parent_id) {
      await supersedePreviousVersion(doc.parent_id, userId);
    }

    const totalMs = Date.now() - pipelineStart;

    logger.agent({
      agentName:     "ingest_agent",
      userId,
      inputSummary:  `${doc.name} (${doc.file_type}, ${buffer.byteLength} bytes, v${doc.version})`,
      outputSummary: `${storedCount}/${chunks.length} chunks indexed, ${pageCount} pages, hasPII=${hasPII}`,
      durationMs:    totalMs,
      success:       true,
    });

    auditLog({
      userId,
      action:       "document_indexed",
      resourceType: "document",
      resourceId:   documentId,
      metadata:     { chunks: storedCount, pageCount, hasPII, method, version: doc.version },
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
