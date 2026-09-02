/**
 * Transovo SMS dispatch worker — runs 24/7 in a dedicated container (repurposed voice worker).
 *
 * Start: npm run worker:sms
 * Requires DATABASE_URL. Optional Redis when QUEUE_DRIVER=bullmq.
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { runSmsSchedulerCycle } from "../src/lib/messaging/dispatch/scheduler";
import {
  collectDispatchMetrics,
  recordWorkerHeartbeat,
} from "../src/lib/messaging/dispatch/heartbeat";
import { processSmsWorkerDueJobs } from "../src/lib/jobs/sms-worker-jobs";

const WORKER_KEY = "sms-dispatch";
const WORKER_ID = process.env.WORKER_ID?.trim() || randomUUID();
const POLL_MS = Number(process.env.WORKER_POLL_MS || 3_000);
const HEALTH_PORT = Number(process.env.SMS_WORKER_HEALTH_PORT || 8082);
const JOB_BATCH = Number(process.env.SMS_WORKER_JOB_BATCH || 40);

let shuttingDown = false;
let cycleInFlight = false;
let lastCycleAt = 0;
let lastCycleOk = true;
let lastCycleError: string | null = null;
let lastMetrics: Record<string, unknown> = {};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(JSON.stringify({ event: "worker_boot_failed", missing: name }));
    process.exit(1);
  }
  return value;
}

function verifyWorkerBootEnv() {
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function startHealthServer() {
  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] || "/";
    if (path === "/health" || path === "/") {
      const staleMs = lastCycleAt ? Date.now() - lastCycleAt : null;
      const maxStale = Number(process.env.SMS_WORKER_MAX_STALE_MS || POLL_MS * 10);
      const healthy = lastCycleOk && !shuttingDown && staleMs != null && staleMs < maxStale;
      res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: healthy,
          workerKey: WORKER_KEY,
          workerId: WORKER_ID,
          lastCycleAt: lastCycleAt ? new Date(lastCycleAt).toISOString() : null,
          lastCycleError,
          shuttingDown,
          metrics: lastMetrics,
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(HEALTH_PORT, "0.0.0.0", () => {
    console.log(
      JSON.stringify({ event: "worker_health_listen", port: HEALTH_PORT, workerId: WORKER_ID }),
    );
  });
  return server;
}

async function runCycle() {
  if (shuttingDown || cycleInFlight) return;
  cycleInFlight = true;
  const started = Date.now();
  try {
    const scheduler = await runSmsSchedulerCycle();
    const jobs = await processSmsWorkerDueJobs(JOB_BATCH);
    const metrics = await collectDispatchMetrics();
    lastMetrics = {
      cycleMs: Date.now() - started,
      jobsProcessed: jobs.processed,
      messagesEnqueued: scheduler.messagesEnqueued,
      campaignsActivated: scheduler.campaignsActivated,
      waitsAdvanced: scheduler.waitsAdvanced,
      reservationsReleased: scheduler.reservationsReleased,
      deliveriesReconciled: scheduler.deliveriesReconciled,
      ...metrics,
    };
    await recordWorkerHeartbeat(WORKER_KEY, WORKER_ID, lastMetrics);
    lastCycleAt = Date.now();
    lastCycleOk = true;
    lastCycleError = null;

    if (
      jobs.processed > 0 ||
      scheduler.messagesEnqueued > 0 ||
      scheduler.campaignsActivated > 0 ||
      scheduler.waitsAdvanced > 0
    ) {
      console.log(
        JSON.stringify({
          event: "worker_cycle",
          workerId: WORKER_ID,
          ...scheduler,
          jobsProcessed: jobs.processed,
          cycleMs: Date.now() - started,
        }),
      );
    }
  } catch (err) {
    lastCycleOk = false;
    lastCycleError = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "worker_cycle_error", error: lastCycleError }));
  } finally {
    cycleInFlight = false;
  }
}

async function main() {
  verifyWorkerBootEnv();

  console.log(
    JSON.stringify({
      event: "worker_started",
      workerKey: WORKER_KEY,
      workerId: WORKER_ID,
      pollMs: POLL_MS,
      queueDriver: process.env.QUEUE_DRIVER || "db",
    }),
  );

  const healthServer = startHealthServer();

  const onSignal = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ event: "worker_shutdown", signal, workerId: WORKER_ID }));
    healthServer.close();
    const waitForCycle = () => {
      if (!cycleInFlight) {
        process.exit(0);
        return;
      }
      setTimeout(waitForCycle, 100);
    };
    waitForCycle();
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  await runCycle();
  setInterval(runCycle, POLL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
