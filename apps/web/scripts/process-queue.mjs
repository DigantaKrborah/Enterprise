/**
 * Local document queue processor.
 * Run alongside `npm run dev` to index documents uploaded via Cloudflare Pages.
 *
 * Usage:  npm run process-queue
 *
 * Requires: `npm run dev` must be running locally.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dir, "../.env.local");
  let raw;
  try { raw = readFileSync(envPath, "utf8"); }
  catch { console.error("❌  .env.local not found"); process.exit(1); }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_MS          = 20_000;
const BATCH            = 5;
const CANDIDATE_PORTS  = [3000, 3001, 3002, 3003];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Discover which port Next.js is listening on ──────────────────────────────
async function discoverServer() {
  // If caller supplied QUEUE_SERVER_URL use it directly.
  if (process.env.QUEUE_SERVER_URL) return process.env.QUEUE_SERVER_URL;

  for (let attempt = 0; attempt < 15; attempt++) {
    for (const port of CANDIDATE_PORTS) {
      try {
        // Any HTTP response (even 503 when Elasticsearch is down) means
        // the Next.js server is up and accepting connections.
        await fetch(`http://localhost:${port}/api/health`, {
          signal: AbortSignal.timeout(2000),
        });
        console.log(`✅  Found Next.js dev server on port ${port}`);
        return `http://localhost:${port}`;
      } catch { /* port not ready yet */ }
    }
    if (attempt === 0) console.log("⏳  Waiting for Next.js dev server (npm run dev)...");
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.error("❌  Could not find Next.js server on ports 3000-3003. Is `npm run dev` running?");
  process.exit(1);
}

// ── Main poll loop ───────────────────────────────────────────────────────────
async function poll(serverUrl) {
  const { data: queued, error } = await supabase
    .from("documents")
    .select("id, name, uploaded_by")
    .eq("status", "queued")
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) { console.warn("⚠️  DB poll error:", error.message); return; }
  if (!queued?.length) return;

  console.log(`\n📄  ${queued.length} queued document(s) — triggering ingest...`);

  for (const doc of queued) {
    try {
      const res = await fetch(`${serverUrl}/api/ingest/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ documentId: doc.id }),
        signal:  AbortSignal.timeout(10_000),
      });
      const json = await res.json();
      if (json.skipped) {
        console.log(`  ⏭️  ${doc.name} — already processing (${json.status})`);
      } else if (json.ok) {
        console.log(`  🚀  ${doc.name} — indexing started`);
      } else {
        console.warn(`  ⚠️  ${doc.name} — ${JSON.stringify(json)}`);
      }
    } catch (err) {
      console.warn(`  ⚠️  ${doc.name} — trigger failed: ${err.message}`);
    }
  }
}

const serverUrl = await discoverServer();
console.log(`🔁  Queue processor running — polling every ${POLL_MS / 1000}s. Ctrl+C to stop.\n`);

await poll(serverUrl);
setInterval(() => poll(serverUrl), POLL_MS);
