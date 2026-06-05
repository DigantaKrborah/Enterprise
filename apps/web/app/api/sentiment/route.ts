import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { auditLog } from "@/lib/audit";
import { badRequest, rateLimited, serverError } from "@/lib/errors";
import { chatRateLimit } from "@/lib/rate-limit";
import { containsPII, scanAndMaskPII } from "@/lib/pii";
import { streamOllamaChat } from "@/lib/llm/ollama";
import { streamClaudeChat } from "@/lib/llm/claude";

interface SentimentResult {
  sentiment: "Positive" | "Negative" | "Neutral";
  tone: string;
  confidence: number;
  summary: string;
  scores: Array<{ label: string; value: number; color: string }>;
  entities: Array<{ t: string; v: string }>;
}

const SENTIMENT_SYSTEM =
  "You are a sentiment analysis engine. Analyze the provided text and return ONLY valid JSON with no markdown, no code fences, and no explanation. " +
  "The JSON must exactly match this shape: " +
  '{ "sentiment": "Positive" | "Negative" | "Neutral", "tone": string, "confidence": number (0–1), "summary": string, ' +
  '"scores": [ ' +
  '{ "label": "Frustration", "value": number (0–1), "color": "var(--red)" }, ' +
  '{ "label": "Urgency", "value": number (0–1), "color": "var(--amber)" }, ' +
  '{ "label": "Constructiveness", "value": number (0–1), "color": "var(--green)" } ' +
  '], ' +
  '"entities": array of { "t": entityType, "v": entityValue } where entityType is one of: person, date, team, action, doc, metric — include only entities that are present in the text ' +
  '}. ' +
  "Output nothing except the JSON object.";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const { user, error } = await requireAuth(request);
  if (error) return error;

  const body = await request.json() as { text?: string };

  if (!body.text?.trim()) return badRequest("text is required");
  if (body.text.length > 10000) return badRequest("text too long (max 10000 chars)");

  if (!chatRateLimit(user!.id)) return rateLimited();

  const hasPII = containsPII(body.text);
  const { maskedText } = scanAndMaskPII(body.text);
  const analysisText = hasPII ? maskedText : body.text;

  const ollamaModel = process.env.OLLAMA_CHAT_MODEL ?? "llama3.2:3b";
  const claudeModel = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
  const messages = [{ role: "user" as const, content: "Analyze this text:\n\n" + analysisText }];

  let fullResponse = "";

  try {
    if (hasPII) {
      await streamOllamaChat({
        model: ollamaModel,
        messages: [{ role: "system", content: SENTIMENT_SYSTEM }, ...messages],
        onChunk: (c) => { fullResponse += c; },
        userId: user!.id,
      });
    } else {
      await streamClaudeChat({
        model: claudeModel,
        systemPrompt: SENTIMENT_SYSTEM,
        messages,
        maxTokens: 1024,
        onChunk: (c) => { fullResponse += c; },
        userId: user!.id,
      });
    }
  } catch (err) {
    logger.error("api", "Sentiment LLM call failed", { error: String(err) }, user!.id);
    return serverError();
  }

  let cleaned = fullResponse.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "").trim();
  }

  let result: SentimentResult;
  try {
    result = JSON.parse(cleaned) as SentimentResult;
  } catch {
    logger.error("api", "Sentiment JSON parse failed", { raw: fullResponse.slice(0, 200) }, user!.id);
    return serverError();
  }

  auditLog({
    userId: user!.id,
    action: "sentiment_analysis",
    metadata: { chars: body.text.length, hasPII },
  });

  logger.api({
    method: "POST",
    endpoint: "/api/sentiment",
    statusCode: 200,
    latencyMs: Date.now() - start,
    userId: user!.id,
  });

  return NextResponse.json({ data: result });
}
