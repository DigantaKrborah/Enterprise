// Shared streaming utilities for the chat API.
// Both Ollama and Claude routes write SSE events using these helpers.

const encoder = new TextEncoder();

export function sseChunk(content: string): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`);
}

export function sseDone(payload: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ type: "done", ...payload })}\n\n`);
}

export function sseError(message: string): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
}

export const SSE_HEADERS = {
  "Content-Type":  "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection":    "keep-alive",
  "X-Accel-Buffering": "no", // disable nginx buffering
};
