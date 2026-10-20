/**
 * Prelaunch FAST purge — minutes, not hours.
 * Deletes all calendar_connection_sync + calendar_connections_reconcile job_queue rows
 * in large SQL batches, then clears BullMQ Redis entries (selective or obliterate when safe).
 *
 * Does NOT FLUSHALL. Does NOT touch unrelated job types unless REDIS_OBLITERATE_* is set
 * and safety checks pass (or FORCE).
 *
 * CONFIRM=PRELAUNCH_FAST_PURGE DRY_RUN=0 BATCH_SIZE=25000 \
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 * npx tsx scripts/ar-calendar-sync-prelaunch-fast-purge.ts
 */
import { appendFileSync } from "node:fs";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { getPrisma } from "../src/lib/db";
import { getBullmqConnection, getBullmqRedisUrl } from "../src/lib/jobs/bullmq";

const CAL_SYNC = "calendar_connection_sync";
const CAL_RECONCILE = "calendar_connections_reconcile";
const CAL_SUB_RENEW = "calendar_subscription_renew";
const WEBHOOK = "microsoft_calendar_webhook_process";

const JOB_TYPES_DB = [CAL_SYNC, CAL_RECONCILE, CAL_SUB_RENEW] as const;

const dryRun = process.env.DRY_RUN !== "0";
const batchSize = Math.min(100_000, Math.max(5_000, Number(process.env.BATCH_SIZE || 25_000)));
const logPath = process.env.PURGE_LOG || "/tmp/calendar-fast-purge.log";
const forceRedis = process.env.FORCE_REDIS_PURGE === "1";
const obliterateDefault = process.env.REDIS_OBLITERATE_DEFAULT === "1";
const obliterateMaintenance = process.env.REDIS_OBLITERATE_MAINTENANCE === "1";

function log(msg: string) {
  const line = `${new Date().toISOString()} ${msg}`;
  appendFileSync(logPath, line + "\n");
  console.log(line);
}

async function countJobs(jobType: string) {
  const prisma = getPrisma();
  return prisma.jobQueue.count({ where: { jobType } });
}

async function countMsConnections() {
  return getPrisma().voiceCalendarConnection.count({ where: { provider: "microsoft" } });
}

async function redisMemoryHuman(redis: Redis) {
  const info = await redis.info("memory");
  const used = /used_memory_human:(\S+)/.exec(info)?.[1] ?? "?";
  const max = /maxmemory_human:(\S+)/.exec(info)?.[1] ?? "?";
  return { used, max };
}

async function redisListLen(redis: Redis, key: string) {
  try {
    return await redis.llen(key);
  } catch {
    return -1;
  }
}

/** One DELETE … LIMIT batch via SQL (faster than per-row Prisma delete). */
async function sqlBatchDeleteJobType(jobType: string): Promise<number> {
  const prisma = getPrisma();
  if (dryRun) {
    const remaining = await countJobs(jobType);
    const n = Math.min(batchSize, remaining);
    log(JSON.stringify({ phase: "sql_delete_dry", jobType, wouldDelete: n, remaining }));
    return n;
  }
  const deleted = await prisma.$executeRaw`
    DELETE FROM job_queue
    WHERE id IN (
      SELECT id FROM job_queue
      WHERE "jobType" = ${jobType}
      LIMIT ${batchSize}
    )`;
  const n = Number(deleted);
  log(JSON.stringify({ phase: "sql_delete", jobType, deleted: n }));
  return n;
}

async function purgeAllDbJobTypes(): Promise<void> {
  for (const jobType of JOB_TYPES_DB) {
    let total = 0;
    for (let round = 0; round < 10_000; round++) {
      const n = await sqlBatchDeleteJobType(jobType);
      total += n;
      if (n < batchSize) break;
    }
    const left = await countJobs(jobType);
    log(JSON.stringify({ phase: "db_job_type_done", jobType, totalDeletedApprox: total, remaining: left }));
  }
}

async function countNonCalendarPendingOnQueue(queueName: string) {
  const prisma = getPrisma();
  return prisma.jobQueue.count({
    where: {
      queueName,
      status: { in: ["pending", "deferred", "processing"] },
      jobType: { notIn: [...JOB_TYPES_DB, WEBHOOK] },
    },
  });
}

async function purgeRedisQueue(queueName: string, allowObliterate: boolean) {
  if (!getBullmqRedisUrl()) {
    log(JSON.stringify({ phase: "redis_skip", queueName, reason: "no_redis_url" }));
    return;
  }
  const redis = getBullmqConnection();
  const prefix = "bull";
  const waitKey = `${prefix}:${queueName}:wait`;
  const waitLen = await redisListLen(redis, waitKey);
  const memBefore = await redisMemoryHuman(redis);

  const nonCal = await countNonCalendarPendingOnQueue(queueName);
  log(
    JSON.stringify({
      phase: "redis_plan",
      queueName,
      waitLen,
      nonCalendarPendingInDb: nonCal,
      memBefore,
      allowObliterate,
      dryRun,
    }),
  );

  if (allowObliterate && (nonCal === 0 || forceRedis)) {
    if (dryRun) {
      log(JSON.stringify({ phase: "redis_obliterate_dry", queueName, waitLen }));
      return;
    }
    const queue = new Queue(queueName, { connection: redis });
    try {
      await queue.obliterate({ force: true });
      log(JSON.stringify({ phase: "redis_obliterate_done", queueName }));
    } finally {
      await queue.close();
    }
  } else {
    await purgeCalendarJobsFromRedisLists(queueName, redis);
  }

  const memAfter = await redisMemoryHuman(redis);
  const waitAfter = await redisListLen(redis, waitKey);
  log(JSON.stringify({ phase: "redis_queue_done", queueName, waitAfter, memAfter }));
}

const CAL_JOB_NAMES = new Set([CAL_SYNC, CAL_RECONCILE]);

/** Remove calendar-named jobs from wait/delayed/paused lists without obliterating the whole queue. */
async function purgeCalendarJobsFromRedisLists(queueName: string, redis: Redis) {
  const queue = new Queue(queueName, { connection: redis });
  const chunk = Math.min(2_000, batchSize);
  let totalRemoved = 0;
  try {
    for (const state of ["waiting", "delayed", "paused"] as const) {
      let passes = 0;
      while (passes < 50_000) {
        passes += 1;
        const jobs = await queue.getJobs([state], 0, chunk - 1);
        if (!jobs.length) break;
        let removedThisPass = 0;
        for (const job of jobs) {
          if (!CAL_JOB_NAMES.has(job.name)) continue;
          if (!dryRun) await job.remove().catch(() => undefined);
          removedThisPass += 1;
        }
        totalRemoved += removedThisPass;
        if (removedThisPass === 0) break;
        log(
          JSON.stringify({
            phase: "redis_selective",
            queueName,
            state,
            removedThisPass,
            totalRemoved,
            dryRun,
          }),
        );
      }
    }
  } finally {
    await queue.close();
  }
}

async function purgeMicrosoftConnections() {
  const prisma = getPrisma();
  let total = 0;
  for (;;) {
    const rows = await prisma.voiceCalendarConnection.findMany({
      where: { provider: "microsoft" },
      select: { id: true },
      take: batchSize,
    });
    if (!rows.length) break;
    const ids = rows.map((r) => r.id);
    if (!dryRun) {
      await prisma.voiceCalendarConnection.deleteMany({ where: { id: { in: ids } } });
    }
    total += ids.length;
    log(JSON.stringify({ phase: "connections_batch", deleted: ids.length, total, dryRun }));
    if (rows.length < batchSize) break;
  }
  const left = await countMsConnections();
  log(JSON.stringify({ phase: "connections_done", total, remaining: left }));
}

async function main() {
  if (process.env.CONFIRM !== "PRELAUNCH_FAST_PURGE") {
    throw new Error("Set CONFIRM=PRELAUNCH_FAST_PURGE");
  }

  const before = {
    calSync: await countJobs(CAL_SYNC),
    reconcile: await countJobs(CAL_RECONCILE),
    subRenew: await countJobs(CAL_SUB_RENEW),
    msConn: await countMsConnections(),
  };
  const redis = getBullmqRedisUrl() ? getBullmqConnection() : null;
  const redisBefore = redis ? await redisMemoryHuman(redis) : null;
  log(JSON.stringify({ event: "fast_purge_start", dryRun, batchSize, before, redisBefore }));

  await purgeAllDbJobTypes();
  await purgeRedisQueue("default", obliterateDefault);
  await purgeRedisQueue("maintenance", obliterateMaintenance);
  await purgeMicrosoftConnections();

  const after = {
    calSync: await countJobs(CAL_SYNC),
    reconcile: await countJobs(CAL_RECONCILE),
    subRenew: await countJobs(CAL_SUB_RENEW),
    msConn: await countMsConnections(),
  };
  const redisAfter = redis ? await redisMemoryHuman(redis) : null;
  log(JSON.stringify({ event: "fast_purge_complete", after, redisAfter }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
