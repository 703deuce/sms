import type { JobQueueStatus } from "@/lib/domain";
import { getPrisma } from "@/lib/db";

/** Actionable — never age-deleted. */
export const JOB_QUEUE_ACTIONABLE_STATUSES: JobQueueStatus[] = [
  "pending",
  "processing",
  "deferred",
];

/** Terminal — eligible for retention pruning. */
export const JOB_QUEUE_TERMINAL_STATUSES: JobQueueStatus[] = ["completed", "failed"];

export type JobQueueRetentionConfig = {
  completedRetentionDays: number;
  failedRetentionDays: number;
  batchSize: number;
  maxBatchesPerRun: number;
};

export type JobQueuePruneScope = {
  /** Limit pruning to one job type (tests / targeted cleanup). */
  jobType?: string;
};

export function getJobQueueRetentionConfig(): JobQueueRetentionConfig {
  const completedRetentionDays = Math.max(
    1,
    Number(process.env.JOB_QUEUE_COMPLETED_RETENTION_DAYS || 30),
  );
  const failedRetentionDays = Math.max(
    completedRetentionDays,
    Number(process.env.JOB_QUEUE_FAILED_RETENTION_DAYS || 90),
  );
  const batchSize = Math.min(2000, Math.max(50, Number(process.env.JOB_QUEUE_PRUNE_BATCH_SIZE || 500)));
  const maxBatchesPerRun = Math.min(
    200,
    Math.max(1, Number(process.env.JOB_QUEUE_PRUNE_MAX_BATCHES || 40)),
  );
  return {
    completedRetentionDays,
    failedRetentionDays,
    batchSize,
    maxBatchesPerRun,
  };
}

export type JobQueuePruneResult = {
  examined: number;
  completedDeleted: number;
  failedDeleted: number;
  batches: number;
  durationMs: number;
  retention: JobQueueRetentionConfig;
  errors: string[];
};

function terminalCutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Delete terminal job_queue rows older than retention windows.
 * Never touches pending, processing, or deferred rows.
 */
export async function pruneTerminalJobQueueRows(
  config?: Partial<JobQueueRetentionConfig>,
  scope?: JobQueuePruneScope,
): Promise<JobQueuePruneResult> {
  const retention = { ...getJobQueueRetentionConfig(), ...config };
  const prisma = getPrisma();
  const started = Date.now();
  const completedCutoff = terminalCutoff(retention.completedRetentionDays);
  const failedCutoff = terminalCutoff(retention.failedRetentionDays);

  let examined = 0;
  let completedDeleted = 0;
  let failedDeleted = 0;
  let batches = 0;
  const errors: string[] = [];

  const pruneStatus = async (status: "completed" | "failed", cutoff: Date) => {
    for (let i = 0; i < retention.maxBatchesPerRun; i += 1) {
      const candidates = await prisma.jobQueue.findMany({
        where: {
          status,
          ...(scope?.jobType ? { jobType: scope.jobType } : {}),
          OR: [
            { completedAt: { lt: cutoff, not: null } },
            { completedAt: null, updatedAt: { lt: cutoff } },
          ],
        },
        select: { id: true },
        orderBy: { completedAt: "asc" },
        take: retention.batchSize,
      });
      if (!candidates.length) break;
      examined += candidates.length;
      batches += 1;
      const ids = candidates.map((r) => r.id);
      try {
        const deleted = await prisma.jobQueue.deleteMany({
          where: {
            id: { in: ids },
            status,
            ...(scope?.jobType ? { jobType: scope.jobType } : {}),
          },
        });
        if (status === "completed") completedDeleted += deleted.count;
        else failedDeleted += deleted.count;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${status}:${message}`);
        break;
      }
      if (candidates.length < retention.batchSize) break;
    }
  };

  await pruneStatus("completed", completedCutoff);
  await pruneStatus("failed", failedCutoff);

  return {
    examined,
    completedDeleted,
    failedDeleted,
    batches,
    durationMs: Date.now() - started,
    retention,
    errors,
  };
}

export type JobQueueHealthSnapshot = {
  probedAt: string;
  totals: {
    all: number;
    actionable: number;
    completed: number;
    failed: number;
    processing: number;
  };
  oldestActionable: {
    id: string;
    jobType: string;
    status: JobQueueStatus;
    runAfter: string;
    createdAt: string;
    ageMinutes: number;
  } | null;
  terminalCompletedOlderThanRetention: number;
  terminalFailedOlderThanRetention: number;
  retention: JobQueueRetentionConfig;
  bullmq?: {
    waiting: number;
    delayed: number;
    failed: number;
  };
};

export async function getJobQueueHealthSnapshot(): Promise<JobQueueHealthSnapshot> {
  const prisma = getPrisma();
  const retention = getJobQueueRetentionConfig();
  const now = new Date();
  const completedCutoff = terminalCutoff(retention.completedRetentionDays);
  const failedCutoff = terminalCutoff(retention.failedRetentionDays);

  const [all, actionable, completed, failed, processing] = await Promise.all([
    prisma.jobQueue.count(),
    prisma.jobQueue.count({ where: { status: { in: JOB_QUEUE_ACTIONABLE_STATUSES } } }),
    prisma.jobQueue.count({ where: { status: "completed" } }),
    prisma.jobQueue.count({ where: { status: "failed" } }),
    prisma.jobQueue.count({ where: { status: "processing" } }),
  ]);

  const oldest = await prisma.jobQueue.findFirst({
    where: { status: { in: JOB_QUEUE_ACTIONABLE_STATUSES } },
    orderBy: { runAfter: "asc" },
    select: {
      id: true,
      jobType: true,
      status: true,
      runAfter: true,
      createdAt: true,
    },
  });

  const [completedPrunable, failedPrunable] = await Promise.all([
    prisma.jobQueue.count({
      where: {
        status: "completed",
        OR: [
          { completedAt: { lt: completedCutoff, not: null } },
          { completedAt: null, updatedAt: { lt: completedCutoff } },
        ],
      },
    }),
    prisma.jobQueue.count({
      where: {
        status: "failed",
        OR: [
          { completedAt: { lt: failedCutoff, not: null } },
          { completedAt: null, updatedAt: { lt: failedCutoff } },
        ],
      },
    }),
  ]);

  let bullmq: JobQueueHealthSnapshot["bullmq"];
  if (process.env.REDIS_URL?.trim()) {
    try {
      const { getBullmqQueueDepths } = await import("@/lib/jobs/bullmq-queue-health");
      bullmq = await getBullmqQueueDepths();
    } catch {
      bullmq = undefined;
    }
  }

  const ageMs = oldest ? now.getTime() - oldest.runAfter.getTime() : 0;

  return {
    probedAt: now.toISOString(),
    totals: { all, actionable, completed, failed, processing },
    oldestActionable: oldest
      ? {
          id: oldest.id,
          jobType: oldest.jobType,
          status: oldest.status,
          runAfter: oldest.runAfter.toISOString(),
          createdAt: oldest.createdAt.toISOString(),
          ageMinutes: Math.round(ageMs / 60_000),
        }
      : null,
    terminalCompletedOlderThanRetention: completedPrunable,
    terminalFailedOlderThanRetention: failedPrunable,
    retention,
    bullmq,
  };
}

/** Daily maintenance handler — errors are swallowed by caller. */
export async function runJobQueueTerminalPruneMaintenance() {
  const result = await pruneTerminalJobQueueRows();
  const health = await getJobQueueHealthSnapshot();
  console.log(
    JSON.stringify({
      event: "job_queue_terminal_prune",
      ...result,
      health: {
        totals: health.totals,
        oldestActionable: health.oldestActionable,
        terminalCompletedOlderThanRetention: health.terminalCompletedOlderThanRetention,
        terminalFailedOlderThanRetention: health.terminalFailedOlderThanRetention,
      },
    }),
  );
  return { ...result, health };
}
