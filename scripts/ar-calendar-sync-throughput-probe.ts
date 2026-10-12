/**
 * Read-only production throughput probe for calendar_connection_sync and default-queue contention.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-calendar-sync-throughput-probe.ts
 */
import { getPrisma } from "../src/lib/db";

const JOB = "calendar_connection_sync";
const WEBHOOK_JOB = "microsoft_calendar_webhook_process";
const HOURS = Number(process.env.PROBE_HOURS || 24);

function msStats(samples: number[]) {
  if (!samples.length) return { n: 0, avgMs: null, p50Ms: null, p95Ms: null, maxMs: null };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    n: sorted.length,
    avgMs: Math.round(sum / sorted.length),
    p50Ms: Math.round(p(0.5)),
    p95Ms: Math.round(p(0.95)),
    maxMs: Math.round(sorted[sorted.length - 1]),
  };
}

/** Reconcile discovery enqueues at priority 25; webhook-driven sync uses ~15. */
function classifySyncTrigger(priority: number, idempotencyKey: string | null): string {
  if (idempotencyKey?.includes(":chaser")) return "webhook_chaser_or_inflight_followup";
  if (priority <= 20) return "likely_webhook_or_manual_high_priority";
  if (priority >= 24 && priority <= 26) return "likely_recovery_reconcile";
  return "other";
}

async function main() {
  const prisma = getPrisma();
  const now = new Date();
  const since = new Date(now.getTime() - HOURS * 3600_000);

  const [
    pending,
    processing,
    failed24h,
    oldestPending,
    completedSample,
    createdPerHour,
    completedPerHour,
    defaultQueueByType,
    defaultProcessingByType,
    webhookCreated24h,
    webhookCompleted24h,
    msConnections,
  ] = await Promise.all([
    prisma.jobQueue.count({ where: { jobType: JOB, status: { in: ["pending", "deferred"] } } }),
    prisma.jobQueue.count({ where: { jobType: JOB, status: "processing" } }),
    prisma.jobQueue.count({
      where: { jobType: JOB, status: "failed", updatedAt: { gte: since } },
    }),
    prisma.jobQueue.findFirst({
      where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
      orderBy: { runAfter: "asc" },
      select: { id: true, runAfter: true, createdAt: true, priority: true, payload: true },
    }),
    prisma.jobQueue.findMany({
      where: {
        jobType: JOB,
        status: "completed",
        completedAt: { gte: since },
      },
      orderBy: { completedAt: "desc" },
      take: 5000,
      select: {
        priority: true,
        idempotencyKey: true,
        createdAt: true,
        runAfter: true,
        lockedAt: true,
        completedAt: true,
      },
    }),
    prisma.$queryRaw<
      Array<{ hour: Date; count: bigint }>
    >`SELECT date_trunc('hour', "createdAt") AS hour, COUNT(*)::bigint AS count
      FROM job_queue WHERE "jobType" = ${JOB} AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<
      Array<{ hour: Date; count: bigint }>
    >`SELECT date_trunc('hour', "completedAt") AS hour, COUNT(*)::bigint AS count
      FROM job_queue WHERE "jobType" = ${JOB} AND status = 'completed' AND "completedAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    prisma.jobQueue.groupBy({
      by: ["jobType"],
      where: { queueName: "default", status: { in: ["pending", "deferred"] } },
      _count: { _all: true },
      orderBy: { _count: { jobType: "desc" } },
    }),
    prisma.jobQueue.groupBy({
      by: ["jobType"],
      where: { queueName: "default", status: "processing" },
      _count: { _all: true },
      orderBy: { _count: { jobType: "desc" } },
    }),
    prisma.jobQueue.count({
      where: { jobType: WEBHOOK_JOB, createdAt: { gte: since } },
    }),
    prisma.jobQueue.count({
      where: {
        jobType: WEBHOOK_JOB,
        status: "completed",
        completedAt: { gte: since },
      },
    }),
    prisma.voiceCalendarConnection.count({
      where: { provider: "microsoft", status: { in: ["connected", "needs_reauth"] } },
    }),
  ]);

  const execMs: number[] = [];
  const waitMs: number[] = [];
  const byTrigger: Record<string, { execMs: number[]; waitMs: number[] }> = {};

  for (const row of completedSample) {
    if (!row.lockedAt || !row.completedAt) continue;
    const exec = row.completedAt.getTime() - row.lockedAt.getTime();
    const ready = Math.max(row.runAfter.getTime(), row.createdAt.getTime());
    const wait = row.lockedAt.getTime() - ready;
    execMs.push(exec);
    waitMs.push(Math.max(0, wait));
    const trigger = classifySyncTrigger(row.priority, row.idempotencyKey);
    if (!byTrigger[trigger]) byTrigger[trigger] = { execMs: [], waitMs: [] };
    byTrigger[trigger].execMs.push(exec);
    byTrigger[trigger].waitMs.push(Math.max(0, wait));
  }

  const createdTotal24h = createdPerHour.reduce((a, r) => a + Number(r.count), 0);
  const completedTotal24h = completedPerHour.reduce((a, r) => a + Number(r.count), 0);
  const minutes = HOURS * 60;
  const createdPerMin = createdTotal24h / minutes;
  const completedPerMin = completedTotal24h / minutes;

  const reconcileIntervalMin = Number(process.env.MICROSOFT_CALENDAR_RECONCILE_MINUTES || 5);
  const reconcileBatch = Number(process.env.MICROSOFT_CALENDAR_RECONCILE_BATCH || 750);

  const avgExecSec =
    execMs.length ? execMs.reduce((a, b) => a + b, 0) / execMs.length / 1000 : null;
  const defaultConcurrency = Number(process.env.BULLMQ_DEFAULT_CONCURRENCY || 4);
  const theoreticalMaxPerMin =
    avgExecSec && avgExecSec > 0 ? (defaultConcurrency * 60) / avgExecSec : null;

  const recoveryDemandPerMinAtN = (n: number) => n / reconcileIntervalMin;

  const [
    queueNamePending,
    anyCompleted24h,
    lastCompletedCal,
    heartbeats,
    simPending,
    realPending,
  ] = await Promise.all([
    prisma.jobQueue.groupBy({
      by: ["queueName"],
      where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
      _count: { _all: true },
    }),
    prisma.jobQueue.count({
      where: { status: "completed", completedAt: { gte: since } },
    }),
    prisma.jobQueue.findFirst({
      where: { jobType: JOB, status: "completed" },
      orderBy: { completedAt: "desc" },
      select: {
        completedAt: true,
        lockedAt: true,
        createdAt: true,
        priority: true,
        workspaceId: true,
      },
    }),
    prisma.workerHeartbeat.findMany({
      orderBy: { lastBeatAt: "desc" },
      take: 6,
      select: { workerKey: true, workerId: true, lastBeatAt: true, metricsJson: true },
    }),
    prisma.jobQueue.count({
      where: {
        jobType: JOB,
        status: { in: ["pending", "deferred"] },
        workspaceId: { startsWith: "sim-" },
      },
    }),
    prisma.jobQueue.count({
      where: {
        jobType: JOB,
        status: { in: ["pending", "deferred"] },
        NOT: { workspaceId: { startsWith: "sim-" } },
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        probedAt: now.toISOString(),
        windowHours: HOURS,
        envSnapshot: {
          MICROSOFT_CALENDAR_RECONCILE_MINUTES: process.env.MICROSOFT_CALENDAR_RECONCILE_MINUTES ?? "(default 5)",
          MICROSOFT_CALENDAR_RECONCILE_BATCH: process.env.MICROSOFT_CALENDAR_RECONCILE_BATCH ?? "(default 750)",
          BULLMQ_DEFAULT_CONCURRENCY: process.env.BULLMQ_DEFAULT_CONCURRENCY ?? "(default 4)",
          BULLMQ_MAINTENANCE_CONCURRENCY: process.env.BULLMQ_MAINTENANCE_CONCURRENCY ?? "(default 3)",
          QUEUE_DRIVER: process.env.QUEUE_DRIVER ?? "(unset)",
        },
        calendarSyncQueue: {
          pending,
          processing,
          failed24h,
          oldestPending: oldestPending
            ? {
                id: oldestPending.id,
                runAfter: oldestPending.runAfter.toISOString(),
                createdAt: oldestPending.createdAt.toISOString(),
                ageHoursWaiting: Math.round(
                  (now.getTime() - oldestPending.runAfter.getTime()) / 3600_000,
                ),
                priority: oldestPending.priority,
                connectionId: (oldestPending.payload as Record<string, unknown>)?.connectionId,
              }
            : null,
        },
        last24hTotals: {
          calendarSyncCreated: createdTotal24h,
          calendarSyncCompleted: completedTotal24h,
          createdPerMinute: Math.round(createdPerMin * 100) / 100,
          completedPerMinute: Math.round(completedPerMin * 100) / 100,
          netBacklogGrowthPerMinute: Math.round((createdPerMin - completedPerMin) * 100) / 100,
          microsoftWebhookJobsCreated: webhookCreated24h,
          microsoftWebhookJobsCompleted: webhookCompleted24h,
        },
        createdPerHour: createdPerHour.map((r) => ({
          hour: r.hour.toISOString(),
          count: Number(r.count),
        })),
        completedPerHour: completedPerHour.map((r) => ({
          hour: r.hour.toISOString(),
          count: Number(r.count),
        })),
        durationFromLast5000CompletedSample: {
          execution: msStats(execMs),
          queueWaitBeforeLock: msStats(waitMs),
          byTriggerClass: Object.fromEntries(
            Object.entries(byTrigger).map(([k, v]) => [
              k,
              { execution: msStats(v.execMs), queueWait: msStats(v.waitMs) },
            ]),
          ),
        },
        defaultQueueContention: {
          pendingByJobType: defaultQueueByType.map((r) => ({
            jobType: r.jobType,
            pending: r._count._all,
          })),
          processingByJobType: defaultProcessingByType.map((r) => ({
            jobType: r.jobType,
            processing: r._count._all,
          })),
        },
        microsoftConnectedConnections: msConnections,
        estimates: {
          note: "Illustrative if all default-queue slots served only calendar sync",
          assumedDefaultConcurrency: defaultConcurrency,
          avgExecutionSecondsFromSample: avgExecSec ? Math.round(avgExecSec * 100) / 100 : null,
          theoreticalMaxCalendarSyncsPerMinute: theoreticalMaxPerMin
            ? Math.round(theoreticalMaxPerMin * 100) / 100
            : null,
          recoveryEnqueueDemandPerMinute: {
            at1000Calendars_intervalMin: Math.round(recoveryDemandPerMinAtN(1000) * 100) / 100,
            at10000Calendars_intervalMin: Math.round(recoveryDemandPerMinAtN(10000) * 100) / 100,
            reconcileIntervalMinutesUsed: reconcileIntervalMin,
          },
          maxReconcileBatchPerMinute: reconcileBatch,
        },
        topologyNotes: {
          productionWebDisableInProcessWorker:
            "DISABLE_INPROCESS_WORKER=1 on web disables startBullmqWorkers() in Next.js.",
          smsWorkerQueues:
            "worker:sms starts startSmsDispatchBullmqWorkers() — does NOT include default or maintenance queues (see PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES).",
          defaultQueueConsumer:
            "calendar_connection_sync requires startBullmqWorkers() (worker:all) or in-process worker on web.",
        },
        supplemental: {
          pendingByQueueName: queueNamePending.map((r) => ({
            queueName: r.queueName,
            pending: r._count._all,
          })),
          anyJobCompleted24h: anyCompleted24h,
          lastCompletedCalendarSync: lastCompletedCal,
          pendingSimWorkspaces: simPending,
          pendingNonSimWorkspaces: realPending,
          workerHeartbeats: heartbeats.map((h) => ({
            workerKey: h.workerKey,
            lastBeatAt: h.lastBeatAt.toISOString(),
            metricsJson: h.metricsJson,
          })),
        },
        metricsNotAvailableInDb: [
          "Graph HTTP requests per minute (no centralized counter)",
          "Graph 429 count (only in app logs if logged)",
          "BullMQ Redis queue depth separate from job_queue outbox",
          "Per-sync Graph request count",
        ],
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
