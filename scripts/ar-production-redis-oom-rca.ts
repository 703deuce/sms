/**
 * Read-only Redis + calendar backlog root-cause investigation (production).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-production-redis-oom-rca.ts
 */
import IORedis from "ioredis";
import { getPrisma } from "../src/lib/db";
import { getBullmqRedisUrl } from "../src/lib/jobs/bullmq";

const JOB = "calendar_connection_sync";

function parseRedisInfo(section: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of section.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1).trim();
  }
  return out;
}

async function scanKeyPrefixes(redis: IORedis, pattern: string, sampleLimit = 50_000) {
  const counts = new Map<string, number>();
  let cursor = "0";
  let scanned = 0;
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 1000);
    cursor = next;
    for (const key of keys) {
      scanned += 1;
      const prefix = key.split(":")[0] ?? key;
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
      if (scanned >= sampleLimit) break;
    }
  } while (cursor !== "0" && scanned < sampleLimit);
  return {
    scanned,
    prefixCounts: Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1])),
  };
}

async function redisInvestigation() {
  const url = getBullmqRedisUrl();
  const redis = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: 10_000 });
  try {
    const [infoMemory, infoStats, maxmemory, maxmemoryPolicy, memFrag] = await Promise.all([
      redis.info("memory"),
      redis.info("stats"),
      redis.config("GET", "maxmemory"),
      redis.config("GET", "maxmemory-policy"),
      redis.call("MEMORY", "STATS").catch(() => null),
    ]);
    const mem = parseRedisInfo(infoMemory);
    const stats = parseRedisInfo(infoStats);
    const bullSample = await scanKeyPrefixes(redis, "bull:*", 30_000);
    const queueNames = ["default", "maintenance", "appointment_reminders", "mctb", "sms-send"];
    const queueKeySizes: Record<string, { wait?: number; active?: number; delayed?: number; failed?: number }> =
      {};
    for (const q of queueNames) {
      try {
        queueKeySizes[q] = {
          wait: await redis.llen(`bull:${q}:wait`),
          active: await redis.llen(`bull:${q}:active`),
          delayed: await redis.zcard(`bull:${q}:delayed`),
          failed: await redis.zcard(`bull:${q}:failed`),
        };
      } catch {
        queueKeySizes[q] = {};
      }
    }
    return {
      maxmemory: maxmemory,
      maxmemoryPolicy: maxmemoryPolicy,
      usedMemoryHuman: mem.used_memory_human,
      usedMemoryPeakHuman: mem.used_memory_peak_human,
      maxmemoryHuman: mem.maxmemory_human,
      memFragmentationRatio: mem.mem_fragmentation_ratio,
      totalKeys: stats.total_keys,
      evictedKeys: stats.evicted_keys,
      rejectedConnections: stats.rejected_connections,
      bullKeyPrefixSample: bullSample,
      bullQueueListSizes: queueKeySizes,
      memoryStatsRaw: memFrag ? String(memFrag).slice(0, 500) : null,
    };
  } finally {
    redis.disconnect();
  }
}

async function connectionBreakdown() {
  const prisma = getPrisma();
  const [byStatus, byProvider, totalMs] = await Promise.all([
    prisma.voiceCalendarConnection.groupBy({
      by: ["status"],
      where: { provider: "microsoft" },
      _count: { _all: true },
    }),
    prisma.voiceCalendarConnection.groupBy({
      by: ["provider"],
      _count: { _all: true },
    }),
    prisma.voiceCalendarConnection.count({ where: { provider: "microsoft" } }),
  ]);

  const workspaceBuckets = await prisma.$queryRaw<
    Array<{ bucket: string; count: bigint }>
  >`
    SELECT
      CASE
        WHEN "workspaceId" LIKE 'sim-%' OR "workspaceId" LIKE 'mctb_p0pf_%' THEN 'sim_or_load_test'
        WHEN "workspaceId" LIKE 'cm%' AND length("workspaceId") > 20 THEN 'cuid_workspace'
        WHEN "workspaceId" = 'ws_1' THEN 'ws_1'
        ELSE 'other'
      END AS bucket,
      COUNT(*)::bigint AS count
    FROM voice_calendar_connections
    WHERE provider = 'microsoft'
    GROUP BY 1
    ORDER BY count DESC`;

  const statusConnected = await prisma.voiceCalendarConnection.count({
    where: { provider: "microsoft", status: "connected" },
  });
  const withImport = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM voice_calendar_connections
    WHERE provider = 'microsoft'
      AND status IN ('connected', 'needs_reauth')
      AND (config->'importCalendarIds') IS NOT NULL
      AND jsonb_array_length(COALESCE(config->'importCalendarIds', '[]'::jsonb)) > 0`;

  const recentSync = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM voice_calendar_connections
    WHERE provider = 'microsoft'
      AND "lastSyncAt" >= NOW() - INTERVAL '7 days'`;

  const duplicateWorkspaceConn = await prisma.$queryRaw<
    Array<{ workspaces_with_gt1: bigint }>
  >`
    SELECT COUNT(*)::bigint AS workspaces_with_gt1
    FROM (
      SELECT "workspaceId", COUNT(*) AS c
      FROM voice_calendar_connections
      WHERE provider = 'microsoft' AND status = 'connected'
      GROUP BY "workspaceId"
      HAVING COUNT(*) > 1
    ) t`;

  return {
    totalMicrosoft: totalMs,
    byStatus,
    byProvider,
    workspaceBuckets: workspaceBuckets.map((r) => ({ bucket: r.bucket, count: Number(r.count) })),
    connectedCount: statusConnected,
    connectedWithImportCalendarIds: Number(withImport[0]?.count ?? 0),
    syncedLast7Days: Number(recentSync[0]?.count ?? 0),
    workspacesWithMultipleConnectedMicrosoft: Number(duplicateWorkspaceConn[0]?.workspaces_with_gt1 ?? 0),
  };
}

async function calendarSyncBacklogAnalysis() {
  const prisma = getPrisma();
  const pendingTotal = await prisma.jobQueue.count({
    where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
  });

  const ageBuckets = await prisma.$queryRaw<
    Array<{ bucket: string; count: bigint }>
  >`
    SELECT
      CASE
        WHEN "runAfter" >= NOW() - INTERVAL '1 hour' THEN 'under_1h'
        WHEN "runAfter" >= NOW() - INTERVAL '24 hours' THEN '1h_to_24h'
        WHEN "runAfter" >= NOW() - INTERVAL '7 days' THEN '1d_to_7d'
        ELSE 'over_7d'
      END AS bucket,
      COUNT(*)::bigint AS count
    FROM job_queue
    WHERE "jobType" = ${JOB} AND status IN ('pending', 'deferred')
    GROUP BY 1
    ORDER BY 1`;

  const priorityDist = await prisma.jobQueue.groupBy({
    by: ["priority"],
    where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
    _count: { _all: true },
    orderBy: { _count: { priority: "desc" } },
  });

  const uniqueConnections = await prisma.$queryRaw<Array<{ unique_connections: bigint }>>`
    SELECT COUNT(DISTINCT payload->>'connectionId')::bigint AS unique_connections
    FROM job_queue
    WHERE "jobType" = ${JOB} AND status IN ('pending', 'deferred')`;

  const jobsPerConnection = await prisma.$queryRaw<
    Array<{ p50: number | null; p95: number | null; max: number | null; connections: bigint }>
  >`
    WITH per_conn AS (
      SELECT payload->>'connectionId' AS connection_id, COUNT(*)::int AS job_count
      FROM job_queue
      WHERE "jobType" = ${JOB} AND status IN ('pending', 'deferred')
      GROUP BY 1
    )
    SELECT
      COUNT(*)::bigint AS connections,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY job_count)::float AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY job_count)::float AS p95,
      MAX(job_count)::int AS max
    FROM per_conn`;

  const workspacePending = await prisma.$queryRaw<
    Array<{ bucket: string; count: bigint }>
  >`
    SELECT
      CASE
        WHEN "workspaceId" LIKE 'sim-%' OR "workspaceId" LIKE 'mctb_p0pf_%' THEN 'sim_or_load_test'
        WHEN "workspaceId" = 'ws_1' THEN 'ws_1'
        WHEN "workspaceId" IS NULL THEN 'null_workspace'
        ELSE 'other_real'
      END AS bucket,
      COUNT(*)::bigint AS count
    FROM job_queue
    WHERE "jobType" = ${JOB} AND status IN ('pending', 'deferred')
    GROUP BY 1
    ORDER BY count DESC`;

  const idempotencyPattern = await prisma.$queryRaw<
    Array<{ has_chaser: boolean; count: bigint }>
  >`
    SELECT
      ("idempotencyKey" LIKE '%:chaser') AS has_chaser,
      COUNT(*)::bigint AS count
    FROM job_queue
    WHERE "jobType" = ${JOB} AND status IN ('pending', 'deferred')
    GROUP BY 1`;

  const incrementalFlag = await prisma.$queryRaw<
    Array<{ incremental: string; count: bigint }>
  >`
    SELECT COALESCE(payload->>'incremental', 'null') AS incremental, COUNT(*)::bigint AS count
    FROM job_queue
    WHERE "jobType" = ${JOB} AND status IN ('pending', 'deferred')
    GROUP BY 1`;

  const createdPerDay = await prisma.$queryRaw<
    Array<{ day: Date; count: bigint }>
  >`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
    FROM job_queue
    WHERE "jobType" = ${JOB}
    GROUP BY 1
    ORDER BY day DESC
    LIMIT 14`;

  return {
    pendingTotal,
    ageBuckets: ageBuckets.map((r) => ({ bucket: r.bucket, count: Number(r.count) })),
    priorityDist,
    uniquePendingConnections: Number(uniqueConnections[0]?.unique_connections ?? 0),
    jobsPerConnectionStats: jobsPerConnection[0]
      ? {
          connections: Number(jobsPerConnection[0].connections),
          p50: jobsPerConnection[0].p50,
          p95: jobsPerConnection[0].p95,
          max: jobsPerConnection[0].max,
        }
      : null,
    pendingByWorkspaceBucket: workspacePending.map((r) => ({
      bucket: r.bucket,
      count: Number(r.count),
    })),
    idempotencyChaser: idempotencyPattern.map((r) => ({
      hasChaser: r.has_chaser,
      count: Number(r.count),
    })),
    incrementalPayload: incrementalFlag.map((r) => ({
      incremental: r.incremental,
      count: Number(r.count),
    })),
    createdPerDayLast14: createdPerDay.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    })),
  };
}

async function reconcileAndOtherQueues() {
  const prisma = getPrisma();
  const since7d = new Date(Date.now() - 7 * 24 * 3600_000);
  const since24hIso = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [
    reconcileCompleted7d,
    reconcileCreated7d,
    calSyncCreated7d,
    arPendingRow,
    arProcessingRow,
    mctbPendingRow,
    smsPendingRow,
    failedDefault24h,
  ] = await Promise.all([
    prisma.jobQueue.count({
      where: { jobType: "calendar_connections_reconcile", status: "completed", completedAt: { gte: since7d } },
    }),
    prisma.jobQueue.count({
      where: { jobType: "calendar_connections_reconcile", createdAt: { gte: since7d } },
    }),
    prisma.jobQueue.count({
      where: { jobType: JOB, createdAt: { gte: since7d } },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM job_queue
      WHERE "jobType" LIKE 'ar_%' AND status IN ('pending', 'deferred')`,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM job_queue
      WHERE "jobType" LIKE 'ar_%' AND status = 'processing'`,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM job_queue
      WHERE "jobType" LIKE 'mctb_%' AND status IN ('pending', 'deferred')`,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM job_queue
      WHERE "queueName" = 'sms-send' AND status IN ('pending', 'deferred')`,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM job_queue
      WHERE "queueName" = 'default' AND status = 'failed' AND "updatedAt" >= ${since24hIso}::timestamptz`,
  ]);
  const arPending = Number(arPendingRow[0]?.count ?? 0);
  const arProcessing = Number(arProcessingRow[0]?.count ?? 0);
  const mctbPending = Number(mctbPendingRow[0]?.count ?? 0);
  const smsPending = Number(smsPendingRow[0]?.count ?? 0);
  const failedDefault24hCount = Number(failedDefault24h[0]?.count ?? 0);

  return {
    last7Days: {
      calendarConnectionsReconcileCreated: reconcileCreated7d,
      calendarConnectionsReconcileCompleted: reconcileCompleted7d,
      calendarConnectionSyncCreated: calSyncCreated7d,
    },
    currentBacklog: {
      arJobsPending: arPending,
      arJobsProcessing: arProcessing,
      mctbJobsPending: mctbPending,
      smsSendPending: smsPending,
    },
    failedDefaultQueue24h: failedDefault24hCount,
  };
}

async function main() {
  const now = new Date();
  const [redis, connections, backlog, queues] = await Promise.all([
    redisInvestigation().catch((e) => ({ error: e instanceof Error ? e.message : String(e) })),
    connectionBreakdown(),
    calendarSyncBacklogAnalysis(),
    reconcileAndOtherQueues(),
  ]);

  console.log(
    JSON.stringify(
      {
        probedAt: now.toISOString(),
        redis,
        microsoftConnections: connections,
        calendarSyncBacklog: backlog,
        schedulerAndCrossProduct: queues,
        investigationNotes: {
          idempotency:
            "One calendar-sync job per connection per minute bucket (inc/full separate). Reconcile can re-enqueue after enqueue lease (~2m) expires while prior jobs remain pending.",
          supersessionHypothesis:
            "Incremental sync uses microsoftDeltaLinks per calendar; one successful incremental per connection may supersede many pending recovery jobs IF checkpoints intact — requires per-connection validation before bulk cancel.",
          webhookJobs:
            "microsoft_calendar_webhook_process is separate; do not bulk-delete without review.",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
