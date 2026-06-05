import { logger } from "@/lib/logger";

const ES_URL   = process.env.ELASTICSEARCH_URL   ?? "http://localhost:9200";
const ES_INDEX = process.env.ELASTICSEARCH_INDEX ?? "enterprise_documents";
const TIMEOUT  = 5000;

export interface ESChunk {
  chunkId:      string;
  documentId:   string;
  departmentId: string;
  content:      string;
  pageNumber:   number | null;
  docName:      string;
  docType:      string;
  version:      number;
  createdAt:    string;
}

// Lazy-init the index mapping on first write.
let indexReady = false;

async function ensureIndex(): Promise<void> {
  if (indexReady) return;
  try {
    const check = await fetch(`${ES_URL}/${ES_INDEX}`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (check.status === 404) {
      await fetch(`${ES_URL}/${ES_INDEX}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: {
            properties: {
              document_id:   { type: "keyword" },
              chunk_id:      { type: "keyword" },
              department_id: { type: "keyword" },
              content:       { type: "text", analyzer: "english" },
              page_number:   { type: "integer" },
              doc_name:      { type: "text", fields: { keyword: { type: "keyword" } } },
              doc_type:      { type: "keyword" },
              version:       { type: "integer" },
              created_at:    { type: "date" },
            },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
    }
    indexReady = true;
  } catch {
    // ES not reachable — mark as not ready, will retry next call
    indexReady = false;
    throw new Error("Elasticsearch not reachable");
  }
}

export async function indexChunk(chunk: ESChunk): Promise<void> {
  await ensureIndex();
  const res = await fetch(`${ES_URL}/${ES_INDEX}/_doc/${chunk.chunkId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id:   chunk.documentId,
      chunk_id:      chunk.chunkId,
      department_id: chunk.departmentId,
      content:       chunk.content,
      page_number:   chunk.pageNumber,
      doc_name:      chunk.docName,
      doc_type:      chunk.docType,
      version:       chunk.version,
      created_at:    chunk.createdAt,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`ES index failed: ${res.status}`);
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await ensureIndex();
  await fetch(`${ES_URL}/${ES_INDEX}/_delete_by_query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: { term: { document_id: documentId } } }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
}

export interface ESSearchResult {
  chunkId:    string;
  documentId: string;
  content:    string;
  score:      number;
  docName:    string;
  pageNumber: number | null;
}

export async function keywordSearch(
  query: string,
  departmentId: string | null,
  topK = 5,
): Promise<ESSearchResult[]> {
  await ensureIndex();

  const must: unknown[] = [{ match: { content: { query, operator: "or" } } }];
  if (departmentId) must.push({ term: { department_id: departmentId } });

  const res = await fetch(`${ES_URL}/${ES_INDEX}/_search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size: topK, query: { bool: { must } } }),
    signal: AbortSignal.timeout(TIMEOUT),
  });

  if (!res.ok) throw new Error(`ES search failed: ${res.status}`);

  const data = await res.json() as {
    hits: { hits: { _id: string; _score: number; _source: Record<string, unknown> }[] };
  };

  return data.hits.hits.map((h) => ({
    chunkId:    h._id,
    documentId: h._source.document_id as string,
    content:    h._source.content as string,
    score:      h._score,
    docName:    h._source.doc_name as string,
    pageNumber: h._source.page_number as number | null,
  }));
}

// Returns true if Elasticsearch is healthy and reachable.
export async function isESHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${ES_URL}/_cluster/health`, { signal: AbortSignal.timeout(3000) });
    const body = await res.json() as { status?: string };
    return body.status !== "red";
  } catch {
    return false;
  }
}

// Logs a warning but never throws — ES is optional (pgvector is the primary store).
export async function tryIndexChunk(chunk: ESChunk): Promise<void> {
  try {
    await indexChunk(chunk);
  } catch (err) {
    logger.warn("search", "ES chunk index skipped (non-fatal)", {
      chunkId: chunk.chunkId,
      error: String(err),
    });
  }
}
