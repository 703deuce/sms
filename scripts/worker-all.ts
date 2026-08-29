/**
 * Job drain process — started automatically by `scripts/start-production.mjs`
 * in the same Coolify web container (sibling of Next.js).
 *
 * Can also run manually: npm run worker:all
 * Only disable the embedded spawn (EMBEDDED_JOB_WORKER=0) if another consumer
 * already drains this queue.
 */
import { processDueJobs } from "../src/lib/jobs/job-handlers";

const INTERVAL_MS = Number(process.env.WORKER_POLL_MS || 5_000);
const useBullmq = process.env.QUEUE_DRIVER === "bullmq" && Boolean(process.env.REDIS_URL);

async function tick() {
  try {
    const result = await processDueJobs(40);
    if (result.processed > 0) {
      console.log(
        `[worker] processed=${result.processed}`,
        result.results.map((r) => `${r.jobType}:${r.ok ? "ok" : r.error}`).join(", "),
      );
    }
  } catch (err) {
    console.error("[worker] tick failed", err);
  }
}

async function main() {
  console.log(`[worker] starting (QUEUE_DRIVER=${process.env.QUEUE_DRIVER || "db"})`);

  if (useBullmq) {
    const { startBullmqWorkers } = await import("../src/lib/jobs/bullmq");
    await startBullmqWorkers();
    console.log("[worker] BullMQ-only mode (DB poll disabled to prevent double-send)");
    // Keep process alive; also enqueue the minute batch via lightweight cron tick without claiming
    setInterval(async () => {
      try {
        const { enqueueJob } = await import("../src/lib/messaging/enqueue-advance");
        const minuteKey = new Date().toISOString().slice(0, 16);
        await enqueueJob({
          jobType: "campaign_send_batch",
          queueName: "review-campaign",
          payload: { minuteKey },
          idempotencyKey: `campaign-send-batch:${minuteKey}`,
        });
      } catch (err) {
        console.error("[worker] bullmq minute enqueue failed", err);
      }
    }, INTERVAL_MS);
    return;
  }

  console.log(`[worker] DB poll every ${INTERVAL_MS}ms`);
  await tick();
  setInterval(tick, INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
