import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { badRequest, forbidden, notFound, rateLimited, serverError } from "@/lib/errors";
import { chatRateLimit } from "@/lib/rate-limit";
import { containsPII, scanAndMaskPII } from "@/lib/pii";
import { hybridRetrieve, RetrievedChunk } from "@/lib/rag/retriever";
import { routeLLM } from "@/lib/llm/router";
import { streamOllamaChat } from "@/lib/llm/ollama";
import { streamClaudeChat } from "@/lib/llm/claude";
import { sseChunk, sseDone, sseError, SSE_HEADERS } from "@/lib/llm/stream";
import { auditLog } from "@/lib/audit";

const SYSTEM_PROMPT = `You are RAGBot, an AI assistant for NRL (Niger Refinery Ltd) refinery operations.

You answer questions based ONLY on the provided document excerpts. Rules:
1. Answer only from the provided document excerpts — never fabricate technical specifications
2. If the answer is not in the documents, clearly state: "I don't have that information in the indexed documents."
3. Be concise and precise — this is an operational environment where accuracy is critical
4. Reference specific details from the source documents in your answer
5. Structure your answer clearly with numbered steps for procedural information`;

function buildContextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant documents found.";
  return chunks
    .map((c, i) =>
      `[${i + 1}] Source: "${c.docName}" — Page ${c.pageNumber ?? "N/A"}, v${c.version}\n${c.content}`
    )
    .join("\n\n---\n\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const start = Date.now();
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const supabase = createClient();

  // Verify conversation belongs to user
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, user_id")
    .eq("id", params.id)
    .single();
  if (!conv) return notFound("Conversation");
  if (conv.user_id !== user!.id && user!.role !== "super_admin") return forbidden();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, citations, llm_used, token_count, feedback, created_at")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true });

  logger.api({ method: "GET", endpoint: `/api/chat/conversations/${params.id}/messages`,
    statusCode: 200, latencyMs: Date.now() - start, userId: user!.id });

  return NextResponse.json({ data: messages ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  if (!chatRateLimit(user!.id)) return rateLimited();

  const body = await request.json() as { content?: string; departmentFilter?: string };
  if (!body.content?.trim()) return badRequest("content is required");

  const rawQuery = body.content.trim();
  const supabase = createClient();
  const admin    = getAdminClient();

  // Verify conversation belongs to user
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, user_id, department_filter, title")
    .eq("id", params.id)
    .single();
  if (!conv) return notFound("Conversation");
  if (conv.user_id !== user!.id && user!.role !== "super_admin") return forbidden();

  const deptFilter = body.departmentFilter ?? conv.department_filter ?? user!.departmentId;

  // Scan and mask PII in the raw query — masked version goes to the LLM,
  // raw version (without PII) is saved as the display message.
  const { maskedText: query, hasPII } = scanAndMaskPII(rawQuery);
  if (hasPII) {
    logger.warn("rag_agent", "PII detected in user query — masked before LLM", {
      conversationId: params.id,
    }, user!.id);
  }

  // Save the raw (user-facing) message — not the masked version.
  const { data: userMsg } = await admin.from("messages").insert({
    conversation_id: params.id,
    role:            "user",
    content:         rawQuery,
  }).select("id").single();

  // Auto-title the conversation on first message
  if (conv.title === "New conversation") {
    await admin.from("conversations")
      .update({ title: query.slice(0, 80) })
      .eq("id", params.id);
  }

  // Get conversation history (last 10 messages for context window)
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const historyMessages = (history ?? []).reverse().slice(0, -1); // exclude the just-saved user msg

  // ── RAG retrieval ────────────────────────────────────────────────────────────
  let chunks: RetrievedChunk[] = [];
  try {
    chunks = await hybridRetrieve({ query, deptId: deptFilter, topK: 5, userId: user!.id });
  } catch (err) {
    logger.error("rag_agent", "Retrieval failed", { error: String(err) }, user!.id);
    // Continue with empty context — LLM will say it has no information
  }

  // Cap context to ~6 000 tokens (≈24 000 chars) to stay within local model limits.
  // Chunks are already ranked by relevance, so truncation drops the weakest tail.
  const RAW_CONTEXT = buildContextBlock(chunks);
  const contextBlock = RAW_CONTEXT.length > 24_000
    ? RAW_CONTEXT.slice(0, 24_000) + "\n\n[Context truncated to fit model window]"
    : RAW_CONTEXT;

  // ── LLM routing ──────────────────────────────────────────────────────────────
  const { provider, model, reason } = routeLLM({
    query,
    contextText: contextBlock,
    history:     historyMessages,
    userId:      user!.id,
  });

  logger.info("rag_agent", `LLM selected: ${provider}/${model}`, { reason }, user!.id);

  // ── Build messages for LLM ───────────────────────────────────────────────────
  const contextMessage = `DOCUMENT EXCERPTS:\n${contextBlock}`;

  const llmMessages = [
    ...historyMessages.map((m) => ({
      role:    m.role as "user" | "assistant",
      content: m.content as string,
    })),
    { role: "user" as const, content: `${contextMessage}\n\nQuestion: ${query}` },
  ];

  // ── Stream response ──────────────────────────────────────────────────────────
  let fullResponse = "";
  let totalTokens  = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const onChunk = (text: string) => {
        fullResponse += text;
        controller.enqueue(sseChunk(text));
      };

      try {
        if (provider === "ollama") {
          const result = await streamOllamaChat({
            model,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...llmMessages],
            onChunk,
            userId: user!.id,
          });
          totalTokens = result.totalTokens;
        } else {
          const result = await streamClaudeChat({
            model,
            systemPrompt: SYSTEM_PROMPT,
            messages:     llmMessages,
            onChunk,
            userId:       user!.id,
          });
          totalTokens = result.inputTokens + result.outputTokens;
        }

        // Build citations from retrieved chunks
        const citations = chunks.map((c) => ({
          doc_id:      c.documentId,
          doc_name:    c.docName,
          chunk_index: c.chunkIndex,
          page:        c.pageNumber,
          dept:        c.deptId,
          version:     c.version,
        }));

        // Save AI message to DB
        await admin.from("messages").insert({
          conversation_id: params.id,
          role:            "assistant",
          content:         fullResponse,
          citations:       citations.length > 0 ? citations : null,
          llm_used:        `${provider}/${model}`,
          token_count:     totalTokens,
        });

        // Update conversation updated_at
        await admin.from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", params.id);

        auditLog({
          userId:       user!.id,
          action:       "chat_query",
          resourceType: "conversation",
          resourceId:   params.id,
          metadata:     { provider, model, chunks: chunks.length, tokens: totalTokens },
        });

        controller.enqueue(sseDone({ citations, model: `${provider}/${model}`, tokens: totalTokens }));
        controller.close();

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("rag_agent", "LLM stream failed", { error: msg, provider, model }, user!.id);
        controller.enqueue(sseError(msg));
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

export async function generateStaticParams() { return []; }
