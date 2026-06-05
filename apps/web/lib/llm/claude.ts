import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export interface ClaudeMessage {
  role:    "user" | "assistant";
  content: string;
}

// Stream a chat completion from Anthropic Claude.
export async function streamClaudeChat(opts: {
  model:        string;
  systemPrompt: string;
  messages:     ClaudeMessage[];
  maxTokens?:   number;
  onChunk:      (text: string) => void;
  userId?:      string;
}): Promise<{ inputTokens: number; outputTokens: number; durationMs: number }> {
  const { model, systemPrompt, messages, maxTokens = 2048, onChunk, userId } = opts;
  const start = Date.now();

  const stream = getClient().messages.stream({
    model,
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onChunk(event.delta.text);
    }
  }

  const finalMsg  = await stream.finalMessage();
  const durationMs = Date.now() - start;
  const inputTokens  = finalMsg.usage.input_tokens;
  const outputTokens = finalMsg.usage.output_tokens;

  logger.llm({
    userId:           userId ?? "system",
    model,
    promptTokens:     inputTokens,
    completionTokens: outputTokens,
    latencyMs:        durationMs,
    cacheHit:         false,
    endpoint:         "chat",
  });

  return { inputTokens, outputTokens, durationMs };
}
