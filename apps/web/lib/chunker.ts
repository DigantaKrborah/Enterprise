// Text chunker — splits extracted document text into overlapping chunks
// for embedding and retrieval. Target: 512 tokens / ~2000 chars per chunk,
// 50-token / ~200-char overlap. Splits on sentence boundaries to avoid
// cutting mid-sentence.

export interface TextChunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
}

const TARGET_CHARS = 2000;  // ~512 tokens
const OVERLAP_CHARS = 200;  // ~50 tokens

// Split text into sentences on common terminators.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function chunkText(text: string, pageNumber?: number): TextChunk[] {
  const sentences = splitSentences(text);
  const chunks: TextChunk[] = [];
  let current = "";
  let chunkIndex = 0;

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > TARGET_CHARS && current.length > 0) {
      chunks.push({ content: current.trim(), chunkIndex: chunkIndex++, pageNumber });

      // Carry forward the overlap — last N characters of current chunk
      const overlapStart = Math.max(0, current.length - OVERLAP_CHARS);
      current = current.slice(overlapStart).trim() + " " + sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push({ content: current.trim(), chunkIndex: chunkIndex++, pageNumber });
  }

  return chunks;
}

// Chunk a multi-page document where text is already split by page.
export function chunkPages(pages: { text: string; pageNumber: number }[]): TextChunk[] {
  const all: TextChunk[] = [];
  let globalIndex = 0;

  for (const { text, pageNumber } of pages) {
    const pageChunks = chunkText(text, pageNumber).map((c) => ({
      ...c,
      chunkIndex: globalIndex++,
    }));
    all.push(...pageChunks);
  }

  return all;
}
