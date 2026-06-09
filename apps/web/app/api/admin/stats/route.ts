export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { serverError } from "@/lib/errors";

type LlmLogRow = {
  data: {
    model?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    latency_ms?: number;
    cache_hit?: boolean;
  };
};

export async function GET(request: NextRequest) {
  const start = Date.now();
  const { user, error } = await requireAuth(request, "super_admin");
  if (error) return error;

  const oneDayAgo = new Date();
  oneDayAgo.setTime(oneDayAgo.getTime() - 86400 * 1000);

  const { data: rows, error: dbErr } = await getAdminClient()
    .from("logs")
    .select("data")
    .eq("log_type", "llm")
    .gte("created_at", oneDayAgo.toISOString());

  if (dbErr) {
    logger.error("api", "Admin stats query failed", { error: dbErr.message }, user!.id);
    return serverError();
  }

  const typedRows = (rows ?? []) as LlmLogRow[];

  const totalLlmCalls = typedRows.length;

  const totalTokens = typedRows.reduce(
    (s, r) => s + (r.data.prompt_tokens ?? 0) + (r.data.completion_tokens ?? 0),
    0
  );

  const avgLatencyMs = typedRows.length
    ? Math.round(typedRows.reduce((s, r) => s + (r.data.latency_ms ?? 0), 0) / typedRows.length)
    : 0;

  const cacheHitRate = typedRows.length
    ? typedRows.filter((r) => r.data.cache_hit).length / typedRows.length
    : 0;

  const modelCounts = typedRows.reduce<Record<string, number>>((acc, r) => {
    const model = r.data.model ?? "unknown";
    acc[model] = (acc[model] ?? 0) + 1;
    return acc;
  }, {});

  const modelBreakdown: Array<{ model: string; count: number }> = Object.entries(modelCounts).map(
    ([model, count]) => ({ model, count })
  );

  logger.api({
    method: "GET",
    endpoint: "/api/admin/stats",
    statusCode: 200,
    latencyMs: Date.now() - start,
    userId: user!.id,
  });

  return NextResponse.json({
    data: { totalLlmCalls, totalTokens, avgLatencyMs, cacheHitRate, modelBreakdown },
  });
}
