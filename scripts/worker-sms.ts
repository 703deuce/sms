/**
 * Transovo SMS dispatch worker — runs 24/7 in a dedicated container (repurposed voice worker).
 *
 * Start: npm run worker:sms
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * When QUEUE_DRIVER=bullmq, also requires REDIS_URL (rediss:// TCP/TLS — not Upstash REST).
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
const MCTB_WORKER_KEY = "mctb-interactive";
const WORKER_ID = process.env.WORKER_ID?.trim() || randomUUID();
const POLL_MS = Number(process.env.WORKER_POLL_MS || 3_000);
const HEALTH_PORT = Number(process.env.SMS_WORKER_HEALTH_PORT || 8082);
const JOB_BATCH = Number(process.env.SMS_WORKER_JOB_BATCH || 40);
const USE_BULLMQ =
  process.env.QUEUE_DRIVER === "bullmq" && Boolean(process.env.REDIS_URL?.trim());

let shuttingDown = false;
let cycleInFlight = false;
let lastCycleAt = 0;
let lastCycleOk = true;
let lastCycleError: string | null = null;
let lastMetrics: Record<string, unknown> = {};
let bullmqBootStatus: Record<string, unknown> | null = null;
let lastBullmqCompleted = 0;

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
  if (USE_BULLMQ) {
    requireEnv("REDIS_URL");
  }
}

function startHealthServer() {
  const server = createServer((req, res) => {
    const path = req.url?.split("?")[0] || "/";
    if (path === "/health" || path === "/") {
      const staleMs = lastCycleAt ? Date.now() - lastCycleAt : null;
      const maxStale = Number(process.env.SMS_WORKER_MAX_STALE_MS || POLL_MS * 10);
      const bullmqReady = Boolean(
        bullmqBootStatus && (bullmqBootStatus as { ready?: boolean }).ready,
      );
      const healthy =
        lastCycleOk &&
        !shuttingDown &&
        staleMs != null &&
        staleMs < maxStale &&
        (!USE_BULLMQ || bullmqReady);
      res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: healthy,
          workerKey: WORKER_KEY,
          workerId: WORKER_ID,
          queueDriver: USE_BULLMQ ? "bullmq" : "db",
          bullmq: bullmqBootStatus,
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
  const phaseMs: Record<string, number> = {};
  try {
    const t0 = Date.now();
    const scheduler = await runSmsSchedulerCycle();
    phaseMs.scheduler = Date.now() - t0;

    const t1 = Date.now();
    const jobs = await processSmsWorkerDueJobs(JOB_BATCH);
    phaseMs.jobs = Date.now() - t1;

    const t2 = Date.now();
    const metrics = await collectDispatchMetrics();
    phaseMs.metrics = Date.now() - t2;

    const bullmqCompleted =
      jobs.mode === "bullmq" ? jobs.bullmq?.metrics.completed ?? 0 : jobs.processed;
    const jobsProcessedThisCycle = Math.max(0, bullmqCompleted - lastBullmqCompleted);
    lastBullmqCompleted = bullmqCompleted;

    lastMetrics = {
      cycleMs: Date.now() - started,
      phaseMs,
      jobsProcessed: jobsProcessedThisCycle,
      jobsProcessedTotal: bullmqCompleted,
      messagesEnqueued: scheduler.messagesEnqueued,
      messagesSkippedAlreadyQueued: scheduler.messagesSkippedAlreadyQueued,
      campaignsActivated: scheduler.campaignsActivated,
      waitsAdvanced: scheduler.waitsAdvanced,
      reservationsReleased: scheduler.reservationsReleased,
      deliveriesReconciled: scheduler.deliveriesReconciled,
      queueDriver: jobs.mode,
      bullmq: jobs.mode === "bullmq" ? jobs.bullmq : undefined,
      outbox: jobs.mode === "bullmq" ? jobs.outbox : undefined,
      ...metrics,
    };
    await recordWorkerHeartbeat(WORKER_KEY, WORKER_ID, lastMetrics);

    if (jobs.mode === "bullmq" && jobs.bullmq) {
      const { getMctbDispatchBullmqStatus } = await import("../src/lib/jobs/bullmq");
      await recordWorkerHeartbeat(MCTB_WORKER_KEY, WORKER_ID, {
        queueDriver: "bullmq",
        mctb: getMctbDispatchBullmqStatus(),
        dispatch: jobs.bullmq,
      });
    }

    if (Math.random() < 0.08) {
      const { reconcileStaleJohnMctbSendJobs } = await import(
        "../src/lib/mctb/messaging/reconcile-stale-john-mctb-jobs"
      );
      void reconcileStaleJohnMctbSendJobs(15).catch(() => undefined);
    }

    lastCycleAt = Date.now();
    lastCycleOk = true;
    lastCycleError = null;

    if (
      jobsProcessedThisCycle > 0 ||
      scheduler.messagesEnqueued > 0 ||
      scheduler.campaignsActivated > 0 ||
      scheduler.waitsAdvanced > 0
    ) {
      console.log(
        JSON.stringify({
          event: "worker_cycle",
          workerId: WORKER_ID,
          ...scheduler,
          jobsProcessed: jobsProcessedThisCycle,
          jobsProcessedTotal: bullmqCompleted,
          cycleMs: Date.now() - started,
          phaseMs,
          queueDriver: jobs.mode,
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

  if (USE_BULLMQ) {
    try {
      const { startSmsDispatchBullmqWorkers, getSmsDispatchBullmqStatus } = await import(
        "../src/lib/jobs/bullmq"
      );
      await startSmsDispatchBullmqWorkers();
      bullmqBootStatus = getSmsDispatchBullmqStatus();
      console.log(JSON.stringify({ event: "worker_boot_success", reason: "bullmq", bullmq: bullmqBootStatus }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ event: "worker_boot_failed", reason: "bullmq", error: message }));
      process.exit(1);
    }
  }

  console.log(
    JSON.stringify({
      event: "worker_started",
      workerKey: WORKER_KEY,
      mctbWorkerKey: MCTB_WORKER_KEY,
      workerId: WORKER_ID,
      pollMs: POLL_MS,
      queueDriver: USE_BULLMQ ? "bullmq" : "db",
      bullmq: bullmqBootStatus,
      mctbQueues: USE_BULLMQ ? bullmqBootStatus?.mctbQueues : undefined,
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
  console.error(JSON.stringify({ event: "worker_boot_failed", error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
