import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function GET() {
  const start = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string }> = {};

  // --- Supabase ---
  try {
    const t = Date.now();
    const { error } = await getAdminClient().from("departments").select("id").limit(1);
    checks.supabase = { ok: !error, latencyMs: Date.now() - t, detail: error?.message };
  } catch (e) {
    checks.supabase = { ok: false, detail: String(e) };
  }

  // --- Elasticsearch ---
  try {
    const t = Date.now();
    const res = await fetch(`${process.env.ELASTICSEARCH_URL}/_cluster/health`, { signal: AbortSignal.timeout(3000) });
    const body = await res.json() as { status?: string };
    checks.elasticsearch = { ok: body.status !== "red", latencyMs: Date.now() - t, detail: body.status };
  } catch (e) {
    checks.elasticsearch = { ok: false, detail: String(e) };
  }

  // --- Ollama ---
  try {
    const t = Date.now();
    const res = await fetch(`${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/tags`, { signal: AbortSignal.timeout(3000) });
    checks.ollama = { ok: res.ok, latencyMs: Date.now() - t };
  } catch (e) {
    checks.ollama = { ok: false, detail: String(e) };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  const totalMs = Date.now() - start;

  logger.api({
    method: "GET",
    endpoint: "/api/health",
    statusCode: allOk ? 200 : 503,
    latencyMs: totalMs,
  });

  return NextResponse.json(
    { ok: allOk, checks, latencyMs: totalMs },
    { status: allOk ? 200 : 503 }
  );
}
