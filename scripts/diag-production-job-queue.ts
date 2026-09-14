/**
 * Read-only production job_queue + worker heartbeat probe.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diag-production-job-queue.ts
 */
import { getPrisma } from "@/lib/db";

async function main() {
  const prisma = getPrisma();
  const now = new Date();

  const statuses = await prisma.jobQueue.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const byType = await prisma.jobQueue.groupBy({
    by: ["jobType", "status"],
    where: { status: { in: ["pending", "deferred", "processing", "failed"] } },
    _count: { _all: true },
  });
  byType.sort((a, b) => b._count._all - a._count._all);

  const oldestPending = await prisma.jobQueue.findFirst({
    where: { status: { in: ["pending", "deferred"] } },
    orderBy: { runAfter: "asc" },
    select: {
      id: true,
      jobType: true,
      queueName: true,
      runAfter: true,
      createdAt: true,
      priority: true,
    },
  });

  const mctbKinds = ["john_mctb_send", "mctb_process_inbound_sms", "mctb_send_customer_sms"];
  const mctbBreakdown: Record<string, unknown> = {};
  for (const jt of mctbKinds) {
    mctbBreakdown[jt] = await prisma.jobQueue.groupBy({
      by: ["status"],
      where: { jobType: jt },
      _count: { _all: true },
    });
  }

  const recentMctbCompleted = await prisma.jobQueue.findFirst({
    where: { jobType: { in: mctbKinds }, status: "completed", completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    select: { jobType: true, completedAt: true, id: true, queueName: true },
  });

  const latestMctbInbound = await prisma.jobQueue.findFirst({
    where: { jobType: "mctb_process_inbound_sms" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true, attempts: true, lastError: true, queueName: true },
  });

  let heartbeat: unknown = null;
  let allHeartbeats: unknown[] = [];
  try {
    heartbeat = await prisma.workerHeartbeat.findFirst({
      where: { workerKey: "sms-dispatch" },
      orderBy: { lastBeatAt: "desc" },
    });
    allHeartbeats = await prisma.workerHeartbeat.findMany({
      orderBy: { lastBeatAt: "desc" },
      take: 8,
      select: { workerKey: true, workerId: true, lastBeatAt: true },
    });
  } catch (e) {
    heartbeat = { tableError: e instanceof Error ? e.message : String(e) };
  }

  const totalJobs = await prisma.jobQueue.count();
  const pendingTotal = await prisma.jobQueue.count({
    where: { status: { in: ["pending", "deferred"] } },
  });
  const processingTotal = await prisma.jobQueue.count({ where: { status: "processing" } });
  const failedTotal = await prisma.jobQueue.count({ where: { status: "failed" } });
  const johnPendingSample = await prisma.jobQueue.findMany({
    where: { jobType: "john_mctb_send", status: "pending" },
    orderBy: { runAfter: "asc" },
    take: 5,
    select: {
      id: true,
      runAfter: true,
      createdAt: true,
      attempts: true,
      priority: true,
      queueName: true,
    },
  });

  const processingStuck = await prisma.jobQueue.count({
    where: {
      status: "processing",
      lockedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });

  const ageMs = oldestPending ? now.getTime() - oldestPending.runAfter.getTime() : null;

  console.log(
    JSON.stringify(
      {
        probedAt: now.toISOString(),
        env: {
          QUEUE_DRIVER: process.env.QUEUE_DRIVER || null,
          REDIS_URL_SET: Boolean(process.env.REDIS_URL?.trim()),
          DISABLE_INPROCESS_WORKER: process.env.DISABLE_INPROCESS_WORKER ?? "(unset in this shell)",
          EMBEDDED_JOB_WORKER: process.env.EMBEDDED_JOB_WORKER ?? "(unset in this shell)",
        },
        jobQueueStatusTotals: statuses,
        activeBacklogByJobTypeAndStatus: byType.slice(0, 40),
        oldestPending: oldestPending
          ? {
              ...oldestPending,
              ageMinutes: Math.round((ageMs || 0) / 60000),
              ageHours: Math.round(((ageMs || 0) / 3600000) * 10) / 10,
            }
          : null,
        mctbBreakdown,
        recentMctbCompleted,
        latestMctbInboundJob: latestMctbInbound,
        processingOlderThan10m: processingStuck,
        totals: { totalJobs, pendingTotal, processingTotal, failedTotal },
        johnMctbSendPendingSample: johnPendingSample,
        workerHeartbeats: allHeartbeats,
        smsDispatchHeartbeat:
          heartbeat && typeof heartbeat === "object" && "lastBeatAt" in heartbeat
            ? {
                workerId: (heartbeat as { workerId?: string }).workerId,
                lastBeatAt: (heartbeat as { lastBeatAt?: Date }).lastBeatAt,
                ageSeconds: (heartbeat as { lastBeatAt?: Date }).lastBeatAt
                  ? Math.round(
                      (now.getTime() - new Date((heartbeat as { lastBeatAt: Date }).lastBeatAt).getTime()) /
                        1000,
                    )
                  : null,
                metricsJson: (heartbeat as { metricsJson?: unknown }).metricsJson,
              }
            : heartbeat,
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
