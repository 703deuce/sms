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
let shuttingDown = false;

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

    const onShutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`[worker] ${signal} — closing BullMQ workers`);
      try {
        const { closeBullmqWorkers } = await import("../src/lib/jobs/bullmq");
        await closeBullmqWorkers();
      } catch (err) {
        console.error("[worker] BullMQ close failed", err);
      }
      process.exit(0);
    };
    process.on("SIGTERM", () => void onShutdown("SIGTERM"));
    process.on("SIGINT", () => void onShutdown("SIGINT"));

    // Keep process alive; minute batch + DB outbox sync (same as worker:sms recovery path).
    setInterval(async () => {
      if (shuttingDown) return;
      try {
        const result = await processDueJobs(40);
        if (result.outbox && typeof result.outbox === "object" && "synced" in result.outbox) {
          const outbox = result.outbox as { synced?: number; examined?: number };
          if ((outbox.synced ?? 0) > 0) {
            console.log(
              `[worker] syncDbOutboxToBullmq synced=${outbox.synced} examined=${outbox.examined}`,
            );
          }
        }
      } catch (err) {
        console.error("[worker] processDueJobs (bullmq tick) failed", err);
      }
      try {
        const { drainCalendarMaintenanceFromDb } = await import(
          "../src/lib/jobs/calendar-maintenance-db-drain"
        );
        const drained = await drainCalendarMaintenanceFromDb(8);
        if (drained.claimed > 0) {
          console.log(
            `[worker] calendar maintenance db-drain claimed=${drained.claimed}`,
            drained.results.map((r) => `${r.jobType}:${r.ok ? "ok" : r.error}`).join(", "),
          );
        }
      } catch (err) {
        console.error("[worker] calendar maintenance db-drain failed", err);
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
