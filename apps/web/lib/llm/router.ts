import { containsPII } from "@/lib/pii";
import { logger } from "@/lib/logger";

export type LLMProvider = "ollama" | "claude";

export interface RoutingDecision {
  provider: LLMProvider;
  model:    string;
  reason:   string;
}

export function routeLLM(opts: {
  query:       string;
  contextText: string;
  history:     { role: string; content: string }[];
  userId?:     string;
}): RoutingDecision {
  const { query, contextText, userId } = opts;
  const ollamaModel = process.env.OLLAMA_CHAT_MODEL ?? "qwen3:8b";

  // Data sovereignty: organisation document content must never leave the local
  // network. Any query that includes RAG context is always routed to Ollama —
  // no exceptions, regardless of context size.
  if (contextText && contextText !== "No relevant documents found.") {
    logger.info("llm_router", "Routing to Ollama: RAG context present (data sovereignty)", { userId });
    return { provider: "ollama", model: ollamaModel, reason: "rag_context_local_only" };
  }

  // PII in the raw query also stays local.
  if (containsPII(query)) {
    logger.info("llm_router", "Routing to Ollama: PII detected in query", { userId });
    return { provider: "ollama", model: ollamaModel, reason: "pii_detected" };
  }

  // Default: local Ollama.
  logger.info("llm_router", "Routing to Ollama: default local path", { userId });
  return { provider: "ollama", model: ollamaModel, reason: "default_local" };
}
