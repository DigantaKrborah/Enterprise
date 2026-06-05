import { getAdminClient } from "@/lib/supabase/admin";
import { embedText } from "@/lib/embedder";
import { keywordSearch } from "@/lib/search/elasticsearch";
import { logger } from "@/lib/logger";

export interface RetrievedChunk {
  chunkId:    string;
  documentId: string;
  docName:    string;
  chunkIndex: number;
  content:    string;
  pageNumber: number | null;
  deptId:     string;
  version:    number;
  score:      number;
  source:     "vector" | "keyword" | "hybrid";
}

// Semantic search via pgvector cosine similarity
async function vectorSearch(
  queryEmbedding: number[],
  deptId: string | null,
  topK: number,
): Promise<RetrievedChunk[]> {
  const { data, error } = await getAdminClient().rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_count:     topK,
    filter_dept_id:  deptId ?? null,
  });

  if (error) throw new Error(`pgvector search failed: ${error.message}`);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    chunkId:    r.id as string,
    documentId: r.document_id as string,
    docName:    r.doc_name as string,
    chunkIndex: r.chunk_index as number,
    content:    r.content as string,
    pageNumber: r.page_number as number | null,
    deptId:     r.dept_id as string,
    version:    r.doc_version as number,
    score:      r.similarity as number,
    source:     "vector" as const,
  }));
}

// Merge vector + keyword results, deduplicate by chunkId, re-rank by combined score
function mergeResults(
  vectorResults: RetrievedChunk[],
  keywordResults: RetrievedChunk[],
): RetrievedChunk[] {
  const map = new Map<string, RetrievedChunk>();

  // Normalise keyword scores (ES scores are unbounded; normalise to 0-1 range)
  const maxKw = Math.max(...keywordResults.map((r) => r.score), 1);

  for (const r of vectorResults) {
    map.set(r.chunkId, { ...r, score: r.score * 0.7 }); // vector weight 70%
  }
  for (const r of keywordResults) {
    const normScore = (r.score / maxKw) * 0.3; // keyword weight 30%
    const existing = map.get(r.chunkId);
    if (existing) {
      map.set(r.chunkId, { ...existing, score: existing.score + normScore, source: "hybrid" });
    } else {
      map.set(r.chunkId, { ...r, score: normScore, source: "keyword" });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.score - a.score);
}

// Hybrid retrieval: vector + keyword search in parallel, merged and re-ranked
export async function hybridRetrieve(opts: {
  query:   string;
  deptId:  string | null;
  topK?:   number;
  userId?: string;
}): Promise<RetrievedChunk[]> {
  const { query, deptId, topK = 5, userId } = opts;
  const start = Date.now();

  // Embed the query
  const { embedding } = await embedText(query);

  // Run vector + keyword search in parallel
  const [vectorResults, keywordResults] = await Promise.allSettled([
    vectorSearch(embedding, deptId, topK),
    keywordSearch(query, deptId, topK),
  ]);

  const vectors  = vectorResults.status  === "fulfilled" ? vectorResults.value  : [];
  const keywords = keywordResults.status === "fulfilled" ? keywordResults.value : [];

  if (vectorResults.status === "rejected") {
    logger.warn("rag_agent", "Vector search failed", { error: String(vectorResults.reason) }, userId);
  }
  if (keywordResults.status === "rejected") {
    logger.warn("rag_agent", "Keyword search failed (ES may be down)", { error: String(keywordResults.reason) }, userId);
  }

  const merged = mergeResults(vectors, keywords).slice(0, topK);

  logger.info("rag_agent", "Retrieval complete", {
    query: query.slice(0, 80),
    vectorHits:  vectors.length,
    keywordHits: keywords.length,
    mergedHits:  merged.length,
    latencyMs:   Date.now() - start,
  }, userId);

  return merged;
}
