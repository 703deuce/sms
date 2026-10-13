/**
 * Prelaunch full reset: Microsoft calendar-sync test backlog only.
 * Requires CONFIRM=PRELAUNCH_FULL_RESET. Default DRY_RUN=1.
 *
 * Does NOT flush Redis. Does NOT touch ar_*, mctb_*, sms-send, webhook process jobs.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   CONFIRM=PRELAUNCH_FULL_RESET DRY_RUN=0 BATCH_SIZE=300 \
 *   npx tsx scripts/ar-calendar-sync-prelaunch-full-reset.ts
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { Queue } from "bullmq";
import { getPrisma } from "../src/lib/db";
import { getBullmqConnection, getBullmqRedisUrl, toBullmqJobId } from "../src/lib/jobs/bullmq";

const CAL_SYNC = "calendar_connection_sync";
const CAL_RECONCILE = "calendar_connections_reconcile";
const ALLOWED_JOB_TYPES = new Set([CAL_SYNC, CAL_RECONCILE]);

const dryRun = process.env.DRY_RUN !== "0";
const batchSize = Math.min(2000, Math.max(50, Number(process.env.BATCH_SIZE || 300)));
const logPath = process.env.RESET_LOG || "/tmp/calendar-prelaunch-reset.log";
const checkpointPath = process.env.RESET_CHECKPOINT || "/tmp/calendar-prelaunch-reset.checkpoint.json";

type Checkpoint = {
  phase: "db_cal_sync" | "db_reconcile" | "bullmq_default" | "bullmq_maintenance" | "connections";
  lastJobId?: string;
  bullmqOffset?: number;
  connectionCursor?: string;
};

function log(msg: string) {
  const line = `${new Date().toISOString()} ${msg}`;
  appendFileSync(logPath, line + "\n");
  console.log(line);
}

function loadCheckpoint(): Checkpoint {
  if (!existsSync(checkpointPath)) return { phase: "db_cal_sync" };
  try {
    return JSON.parse(readFileSync(checkpointPath, "utf8")) as Checkpoint;
  } catch {
    return { phase: "db_cal_sync" };
  }
}

function saveCheckpoint(cp: Checkpoint) {
  if (!dryRun) writeFileSync(checkpointPath, JSON.stringify(cp, null, 2));
}

async function snapshotCounts() {
  const prisma = getPrisma();
  const [calPending, calProcessing, calFailed, reconcilePending, msConn] = await Promise.all([
    prisma.jobQueue.count({ where: { jobType: CAL_SYNC, status: { in: ["pending", "deferred"] } } }),
    prisma.jobQueue.count({ where: { jobType: CAL_SYNC, status: "processing" } }),
    prisma.jobQueue.count({ where: { jobType: CAL_SYNC, status: "failed" } }),
    prisma.jobQueue.count({
      where: { jobType: CAL_RECONCILE, status: { in: ["pending", "deferred", "processing"] } },
    }),
    prisma.voiceCalendarConnection.count({ where: { provider: "microsoft" } }),
  ]);
  return { calPending, calProcessing, calFailed, reconcilePending, msConn };
}

async function redisQueueDepths() {
  if (!getBullmqRedisUrl()) return null;
  const redis = getBullmqConnection();
  const [dw, dm] = await Promise.all([
    redis.llen("bull:default:wait"),
    redis.llen("bull:maintenance:wait"),
  ]);
  return { defaultWait: dw, maintenanceWait: dm };
}

async function removeBullmqByKey(queueName: string, idempotencyKey: string | null) {
  if (!idempotencyKey || dryRun) return;
  const queue = new Queue(queueName, { connection: getBullmqConnection() });
  try {
    const job = await queue.getJob(toBullmqJobId(idempotencyKey));
    if (job) await job.remove();
  } finally {
    await queue.close();
  }
}

async function phaseDbCalSync(cp: Checkpoint): Promise<Checkpoint> {
  const prisma = getPrisma();
  let lastJobId = cp.lastJobId ?? "";
  let deleted = 0;
  let processed = 0;

  while (processed < batchSize) {
    const take = Math.min(150, batchSize - processed);
    const jobs = await prisma.jobQueue.findMany({
      where: {
        jobType: CAL_SYNC,
        ...(lastJobId ? { id: { gt: lastJobId } } : {}),
      },
      orderBy: { id: "asc" },
      take,
      select: { id: true, idempotencyKey: true, queueName: true },
    });
    if (!jobs.length) {
      return { phase: "db_reconcile" };
    }
    for (const job of jobs) {
      processed += 1;
      lastJobId = job.id;
      if (!dryRun) {
        await prisma.jobQueue.delete({ where: { id: job.id } });
        await removeBullmqByKey(job.queueName || "default", job.idempotencyKey);
      }
      deleted += 1;
    }
    if (jobs.length < take) return { phase: "db_reconcile" };
  }

  saveCheckpoint({ phase: "db_cal_sync", lastJobId });
  log(JSON.stringify({ phase: "db_cal_sync", deleted, processed, lastJobId, dryRun }));
  return { phase: "db_cal_sync", lastJobId };
}

async function phaseDbReconcile(): Promise<Checkpoint> {
  const prisma = getPrisma();
  let deleted = 0;
  let processed = 0;
  let lastJobId = "";

  while (processed < batchSize) {
    const take = Math.min(150, batchSize - processed);
    const jobs = await prisma.jobQueue.findMany({
      where: {
        jobType: CAL_RECONCILE,
        ...(lastJobId ? { id: { gt: lastJobId } } : {}),
      },
      orderBy: { id: "asc" },
      take,
      select: { id: true, idempotencyKey: true, queueName: true },
    });
    if (!jobs.length) return { phase: "bullmq_default", bullmqOffset: 0 };
    for (const job of jobs) {
      processed += 1;
      lastJobId = job.id;
      if (!dryRun) {
        await prisma.jobQueue.delete({ where: { id: job.id } });
        await removeBullmqByKey(job.queueName || "maintenance", job.idempotencyKey);
      }
      deleted += 1;
    }
    if (jobs.length < take) return { phase: "bullmq_default", bullmqOffset: 0 };
  }

  log(JSON.stringify({ phase: "db_reconcile", deleted, processed, dryRun }));
  return { phase: "db_reconcile" };
}

async function phaseBullmqSweep(queueName: string, jobNames: Set<string>, offset = 0): Promise<Checkpoint> {
  const queue = new Queue(queueName, { connection: getBullmqConnection() });
  let removed = 0;
  try {
    const states = ["wait", "delayed", "active", "paused"] as const;
    const jobs = await queue.getJobs(states, offset, offset + batchSize - 1);
    if (!jobs.length) {
      return queueName === "default"
        ? { phase: "bullmq_maintenance", bullmqOffset: 0 }
        : { phase: "connections" };
    }
    for (const job of jobs) {
      if (!jobNames.has(job.name)) continue;
      if (!dryRun) await job.remove();
      removed += 1;
    }
    const nextOffset = offset + jobs.length;
    if (jobs.length < batchSize) {
      return queueName === "default"
        ? { phase: "bullmq_maintenance", bullmqOffset: 0 }
        : { phase: "connections" };
    }
    log(JSON.stringify({ phase: `bullmq_${queueName}`, removed, offset: nextOffset, dryRun }));
    return queueName === "default"
      ? { phase: "bullmq_default", bullmqOffset: nextOffset }
      : { phase: "bullmq_maintenance", bullmqOffset: nextOffset };
  } finally {
    await queue.close();
  }
}

async function phaseConnections(cp: Checkpoint): Promise<Checkpoint> {
  const prisma = getPrisma();
  let cursor = cp.connectionCursor ?? "";
  let deleted = 0;
  let processed = 0;

  while (processed < batchSize) {
    const take = Math.min(100, batchSize - processed);
    const rows = await prisma.voiceCalendarConnection.findMany({
      where: {
        provider: "microsoft",
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take,
      select: { id: true },
    });
    if (!rows.length) return { phase: "connections", connectionCursor: "done" };
    for (const row of rows) {
      processed += 1;
      cursor = row.id;
      if (!dryRun) {
        await prisma.voiceCalendarConnection.delete({ where: { id: row.id } });
      }
      deleted += 1;
    }
    if (rows.length < take) {
      log(JSON.stringify({ phase: "connections", deleted, processed, done: true, dryRun }));
      return { phase: "connections", connectionCursor: "done" };
    }
  }

  saveCheckpoint({ phase: "connections", connectionCursor: cursor });
  log(JSON.stringify({ phase: "connections", deleted, processed, connectionCursor: cursor, dryRun }));
  return { phase: "connections", connectionCursor: cursor };
}

async function main() {
  if (process.env.CONFIRM !== "PRELAUNCH_FULL_RESET") {
    throw new Error("Set CONFIRM=PRELAUNCH_FULL_RESET to run prelaunch calendar reset");
  }

  const before = await snapshotCounts();
  const redisBefore = await redisQueueDepths();
  log(JSON.stringify({ event: "reset_start", dryRun, before, redisBefore }));

  let cp = loadCheckpoint();

  if (cp.phase === "db_cal_sync") {
    cp = await phaseDbCalSync(cp);
    if (cp.phase === "db_cal_sync") {
      saveCheckpoint(cp);
      return;
    }
  }

  if (cp.phase === "db_reconcile") {
    cp = await phaseDbReconcile();
    if (cp.phase === "db_reconcile") return;
  }

  if (cp.phase === "bullmq_default") {
    cp = await phaseBullmqSweep("default", new Set([CAL_SYNC]), cp.bullmqOffset ?? 0);
    saveCheckpoint(cp);
    if (cp.phase === "bullmq_default") return;
  }

  if (cp.phase === "bullmq_maintenance") {
    cp = await phaseBullmqSweep("maintenance", new Set([CAL_RECONCILE, CAL_SYNC]), cp.bullmqOffset ?? 0);
    saveCheckpoint(cp);
    if (cp.phase === "bullmq_maintenance") return;
  }

  if (cp.phase === "connections" && cp.connectionCursor !== "done") {
    cp = await phaseConnections(cp);
    saveCheckpoint(cp);
    if (cp.connectionCursor !== "done") return;
  }

  const after = await snapshotCounts();
  const redisAfter = await redisQueueDepths();
  log(JSON.stringify({ event: "reset_batch_complete_or_idle", after, redisAfter }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
