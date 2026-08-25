/**
 * Run the job drain inside the Next.js web process so Coolify only needs
 * the regular app container — no separate `npm run worker:all` service.
 *
 * Disable with DISABLE_INPROCESS_WORKER=1 if you intentionally run an
 * external worker (avoids double-consume with BullMQ or a second poller).
 */

const INTERVAL_MS = Number(process.env.WORKER_POLL_MS || 5_000);

declare global {
  // eslint-disable-next-line no-var
  var __transovoInProcessWorkerStarted: boolean | undefined;
  // eslint-disable-next-line no-var
  var __transovoJobDrainTimer: ReturnType<typeof setTimeout> | undefined;
  // eslint-disable-next-line no-var
  var __transovoJobDrainRunning: boolean | undefined;
}

function useBullmq() {
  return process.env.QUEUE_DRIVER === "bullmq" && Boolean(process.env.REDIS_URL);
}

export function inProcessWorkerEnabled() {
  if (process.env.DISABLE_INPROCESS_WORKER === "1") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}

async function tick() {
  if (globalThis.__transovoJobDrainRunning) return;
  globalThis.__transovoJobDrainRunning = true;
  try {
    const { processDueJobs } = await import("@/lib/jobs/job-handlers");
    const result = await processDueJobs(40);
    if (result.processed > 0) {
      console.log(
        `[web-worker] processed=${result.processed}`,
        result.results.map((r) => `${r.id}:${r.ok ? "ok" : r.error}`).join(", "),
      );
    }
  } catch (err) {
    console.error("[web-worker] tick failed", err);
  } finally {
    globalThis.__transovoJobDrainRunning = false;
  }
}

/** Debounced kick after enqueue — process soon without waiting for the poll interval. */
export function scheduleJobDrain(delayMs = 50) {
  if (!inProcessWorkerEnabled()) return;
  if (useBullmq()) return; // BullMQ workers consume; DB claim would double-send
  if (globalThis.__transovoJobDrainTimer) clearTimeout(globalThis.__transovoJobDrainTimer);
  globalThis.__transovoJobDrainTimer = setTimeout(() => {
    void tick();
  }, delayMs);
}

/**
 * Start polling (DB mode) or BullMQ workers (REDIS mode) inside the web process.
 * Safe to call multiple times — only the first call binds.
 */
export async function startInProcessWorker() {
  if (!inProcessWorkerEnabled()) {
    console.log("[web-worker] disabled (DISABLE_INPROCESS_WORKER=1 or build phase)");
    return;
  }
  if (globalThis.__transovoInProcessWorkerStarted) return;
  globalThis.__transovoInProcessWorkerStarted = true;

  console.log(
    `[web-worker] starting in Next.js process (QUEUE_DRIVER=${process.env.QUEUE_DRIVER || "db"})`,
  );

  if (useBullmq()) {
    const { startBullmqWorkers } = await import("@/lib/jobs/bullmq");
    await startBullmqWorkers();
    console.log("[web-worker] BullMQ consumers attached to web process");
    // Still enqueue minute/hour batch markers via processDueJobs (claim skipped in bullmq mode).
    setInterval(() => {
      void tick();
    }, INTERVAL_MS);
    return;
  }

  console.log(`[web-worker] DB poll every ${INTERVAL_MS}ms`);
  await tick();
  setInterval(() => {
    void tick();
  }, INTERVAL_MS);
}
