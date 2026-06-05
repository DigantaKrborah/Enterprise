import { containsPII } from "@/lib/pii";
import { logger } from "@/lib/logger";

const COMPLEX_THRESHOLD = parseInt(process.env.LLM_COMPLEX_THRESHOLD ?? "8000", 10);

export type LLMProvider = "ollama" | "claude";

export interface RoutingDecision {
  provider:  LLMProvider;
  model:     string;
  reason:    string;
}

// Rough token estimate: 1 token ≈ 4 characters
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function routeLLM(opts: {
  query:       string;
  contextText: string;
  history:     { role: string; content: string }[];
  userId?:     string;
}): RoutingDecision {
  const { query, contextText, history, userId } = opts;

  const ollamaModel = process.env.OLLAMA_CHAT_MODEL ?? "qwen3:8b";
  const claudeModel = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

  // Build total context for token estimation
  const totalText = contextText + history.map((m) => m.content).join(" ") + query;
  const tokenEstimate = estimateTokens(totalText);

  // Rule 1: PII detected in query → local only (data must not leave network)
  if (containsPII(query)) {
    logger.info("llm_router", "Routing to Ollama: PII detected in query", { userId });
    return { provider: "ollama", model: ollamaModel, reason: "pii_detected" };
  }

  // Rule 2: Context too large for local model → Cloud
  if (tokenEstimate > COMPLEX_THRESHOLD) {
    logger.info("llm_router", "Routing to Claude: context exceeds threshold", {
      tokenEstimate, threshold: COMPLEX_THRESHOLD, userId,
    });
    return { provider: "claude", model: claudeModel, reason: "large_context" };
  }

  // Rule 3: Default → local Ollama
  logger.info("llm_router", "Routing to Ollama: default local path", { tokenEstimate, userId });
  return { provider: "ollama", model: ollamaModel, reason: "default" };
}
