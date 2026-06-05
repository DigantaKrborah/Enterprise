import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request, "super_admin");
  if (error) return error;

  logger.api({
    method: "GET",
    endpoint: "/api/admin/llm-config",
    statusCode: 200,
    latencyMs: Date.now() - start,
    userId: user!.id,
  });

  return NextResponse.json({
    data: {
      defaultLlm: process.env.LLM_DEFAULT ?? "ollama",
      complexThreshold: parseInt(process.env.LLM_COMPLEX_THRESHOLD ?? "8000", 10),
      ollamaModel: process.env.OLLAMA_CHAT_MODEL ?? "llama3.2:3b",
      claudeModel: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6",
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      embedModel: process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text",
    },
  });
}
