import { logger } from "./logger";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBED_MODEL = "nomic-embed-text";
const TIMEOUT_MS = 30_000;

export interface EmbedResult {
  embedding: number[];
  latencyMs: number;
}

// Generate an embedding vector for a single text string.
// Uses Ollama's nomic-embed-text model (768 dimensions).
export async function embedText(text: string): Promise<EmbedResult> {
  const start = Date.now();

  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama embeddings failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { embedding: number[] };
  const latencyMs = Date.now() - start;

  logger.llm({
    userId: "system",
    model: EMBED_MODEL,
    promptTokens: Math.ceil(text.length / 4),
    completionTokens: 0,
    latencyMs,
    cacheHit: false,
    endpoint: "embeddings",
  });

  return { embedding: data.embedding, latencyMs };
}

// Embed multiple texts sequentially (Ollama is single-threaded locally).
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    const { embedding } = await embedText(text);
    embeddings.push(embedding);
  }
  return embeddings;
}

// Check that Ollama + the embed model are available.
export async function checkEmbedder(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json() as { models?: { name: string }[] };
    return (data.models ?? []).some((m) => m.name.startsWith("nomic-embed-text"));
  } catch {
    return false;
  }
}
