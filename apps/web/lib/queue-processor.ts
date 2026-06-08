import { getAdminClient } from "@/lib/supabase/admin";
import { runIngestAgent } from "@/lib/agents/ingest-agent";
import { logger } from "@/lib/logger";

const POLL_INTERVAL_MS = 20_000; // check every 20 seconds
const BATCH_SIZE       = 5;      // process up to 5 documents per poll

// Uses globalThis so HMR reloads in dev don't spawn duplicate loops.
const g = globalThis as Record<string, unknown>;

export function startQueueProcessor(): void {
  if (process.env.NODE_ENV === "test") return;
  if (g.__queueProcessorStarted)        return;
  g.__queueProcessorStarted = true;

  async function poll(): Promise<void> {
    try {
      const admin = getAdminClient();

      const { data: queued, error } = await admin
        .from("documents")
        .select("id, uploaded_by, name")
        .eq("status", "queued")
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE) as unknown as {
          data: { id: string; uploaded_by: string; name: string }[] | null;
          error: { message: string } | null;
        };

      if (error) {
        logger.warn("ingest_agent", "Queue poll DB error", { error: error.message });
        return;
      }

      if (!queued?.length) return;

      logger.info("ingest_agent", `Queue processor: ${queued.length} document(s) picked up`, {
        ids: queued.map((d) => d.id),
      });

      for (const doc of queued) {
        runIngestAgent(doc.id, doc.uploaded_by).catch((err) =>
          logger.error("ingest_agent", "Queue processor: ingest failed", {
            docId: doc.id, docName: doc.name, error: String(err),
          })
        );
      }
    } catch (err) {
      logger.warn("ingest_agent", "Queue processor poll exception", { error: String(err) });
    }
  }

  // Wait 5 s for Next.js to finish booting, then start the loop.
  setTimeout(() => {
    logger.info("ingest_agent", "Queue processor started — polling every 20 s");
    poll();
    setInterval(poll, POLL_INTERVAL_MS);
  }, 5_000);
}
