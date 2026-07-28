/**
 * Worker process: drains DB job_queue (and optionally BullMQ when QUEUE_DRIVER=bullmq).
 *
 *   npm run worker:all
 */
import { processDueJobs } from "../src/lib/jobs/job-handlers";

const INTERVAL_MS = Number(process.env.WORKER_POLL_MS || 5_000);

async function tick() {
  try {
    const result = await processDueJobs(40);
    if (result.processed > 0) {
      console.log(`[worker] processed=${result.processed}`, result.results.map((r) => `${r.jobType}:${r.ok ? "ok" : r.error}`).join(", "));
    }
  } catch (err) {
    console.error("[worker] tick failed", err);
  }
}

async function main() {
  console.log(`[worker] starting poll every ${INTERVAL_MS}ms (QUEUE_DRIVER=${process.env.QUEUE_DRIVER || "db"})`);

  if (process.env.QUEUE_DRIVER === "bullmq" && process.env.REDIS_URL) {
    try {
      const { startBullmqWorkers } = await import("../src/lib/jobs/bullmq");
      await startBullmqWorkers();
      console.log("[worker] BullMQ workers attached");
    } catch (err) {
      console.warn("[worker] BullMQ unavailable, continuing with DB poll", err);
    }
  }

  await tick();
  setInterval(tick, INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
