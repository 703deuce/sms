import "server-only";

import { getPrisma } from "@/lib/db";

export type WorkerMetrics = {
  cycleMs?: number;
  jobsProcessed?: number;
  messagesEnqueued?: number;
  campaignsActivated?: number;
  rateLimited?: number;
  oldestDueJobAgeMs?: number | null;
  scheduledCount?: number;
  dueCount?: number;
  queuedCount?: number;
  processingCount?: number;
};

export async function recordWorkerHeartbeat(
  workerKey: string,
  workerId: string,
  metrics?: WorkerMetrics,
) {
  const prisma = getPrisma();
  const now = new Date();
  try {
    await prisma.workerHeartbeat.upsert({
      where: { workerKey },
      create: {
        workerKey,
        workerId,
        lastBeatAt: now,
        metricsJson: metrics ?? {},
      },
      update: {
        workerId,
        lastBeatAt: now,
        metricsJson: metrics ?? {},
      },
    });
  } catch (err) {
    console.warn(
      "[worker-heartbeat] persist failed — run supabase/sms-worker-heartbeat.sql",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function getWorkerHeartbeat(workerKey: string) {
  const prisma = getPrisma();
  return prisma.workerHeartbeat.findUnique({ where: { workerKey } });
}

export async function collectDispatchMetrics(): Promise<WorkerMetrics> {
  const prisma = getPrisma();
  const now = new Date();

  const [scheduledCount, dueCount, queuedCount, processingCount, oldestDue] =
    await Promise.all([
      prisma.campaign.count({ where: { status: "SCHEDULED" } }),
      prisma.campaignMessage.count({
        where: { status: "queued", scheduledFor: { lte: now }, campaign: { status: "SENDING" } },
      }),
      prisma.jobQueue.count({ where: { status: { in: ["pending", "deferred"] } } }),
      prisma.jobQueue.count({ where: { status: "processing" } }),
      prisma.jobQueue.findFirst({
        where: { status: { in: ["pending", "deferred"] }, runAfter: { lte: now } },
        orderBy: { runAfter: "asc" },
        select: { runAfter: true },
      }),
    ]);

  return {
    scheduledCount,
    dueCount,
    queuedCount,
    processingCount,
    oldestDueJobAgeMs: oldestDue
      ? Math.max(0, now.getTime() - oldestDue.runAfter.getTime())
      : null,
  };
}
