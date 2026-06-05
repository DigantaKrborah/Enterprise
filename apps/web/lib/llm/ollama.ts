import { logger } from "@/lib/logger";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

export interface OllamaMessage {
  role:    "system" | "user" | "assistant";
  content: string;
}

// Stream a chat completion from Ollama.
// Calls the callback with each text chunk as it arrives.
export async function streamOllamaChat(opts: {
  model:     string;
  messages:  OllamaMessage[];
  onChunk:   (text: string) => void;
  userId?:   string;
}): Promise<{ totalTokens: number; durationMs: number }> {
  const { model, messages, onChunk, userId } = opts;
  const start = Date.now();

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama chat failed (${res.status}): ${body}`);
  }

  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let totalTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const json = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
          eval_count?: number;
          prompt_eval_count?: number;
        };
        if (json.message?.content) onChunk(json.message.content);
        if (json.done) {
          totalTokens = (json.eval_count ?? 0) + (json.prompt_eval_count ?? 0);
        }
      } catch { /* ignore parse errors on partial lines */ }
    }
  }

  const durationMs = Date.now() - start;
  logger.llm({
    userId:           userId ?? "system",
    model,
    promptTokens:     Math.ceil(messages.map((m) => m.content).join(" ").length / 4),
    completionTokens: totalTokens,
    latencyMs:        durationMs,
    cacheHit:         false,
    endpoint:         "chat",
  });

  return { totalTokens, durationMs };
}
