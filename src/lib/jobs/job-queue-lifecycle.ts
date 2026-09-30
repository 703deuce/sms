import type { JobQueueStatus } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import {
  isProcessDueJobsSchedulerJobType,
  PROCESS_DUE_JOBS_SCHEDULER_JOB_TYPES,
} from "@/lib/jobs/job-queue-scheduler-types";

/** Actionable — never age-deleted. */
export const JOB_QUEUE_ACTIONABLE_STATUSES: JobQueueStatus[] = [
  "pending",
  "processing",
  "deferred",
];

/** Terminal — eligible for retention pruning. */
export const JOB_QUEUE_TERMINAL_STATUSES: JobQueueStatus[] = ["completed", "failed"];

export type JobQueueRetentionConfig = {
  /** Global scheduler ticks from processDueJobs (successful terminal only). */
  schedulerCompletedRetentionHours: number;
  completedRetentionDays: number;
  failedRetentionDays: number;
  batchSize: number;
  maxBatchesPerRun: number;
};

export type JobQueuePruneScope = {
  /** Limit pruning to one job type (tests / targeted cleanup). */
  jobType?: string;
  /** Limit pruning to row ids with this prefix (tests). */
  idPrefix?: string;
};

export function getJobQueueRetentionConfig(): JobQueueRetentionConfig {
  const schedulerCompletedRetentionHours = Math.max(
    1,
    Number(process.env.JOB_QUEUE_SCHEDULER_COMPLETED_RETENTION_HOURS || 48),
  );
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
    schedulerCompletedRetentionHours,
    completedRetentionDays,
    failedRetentionDays,
    batchSize,
    maxBatchesPerRun,
  };
}

export type JobQueuePruneResult = {
  examined: number;
  schedulerCompletedDeleted: number;
  normalCompletedDeleted: number;
  completedDeleted: number;
  failedDeleted: number;
  batches: number;
  durationMs: number;
  retention: JobQueueRetentionConfig;
  errors: string[];
};

function cutoffFromDays(days: number): Date {
  const d = Number(days);
  if (!Number.isFinite(d) || d <= 0) {
    throw new Error(`Invalid JOB_QUEUE_COMPLETED_RETENTION_DAYS: ${days}`);
  }
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

function cutoffFromHours(hours: number): Date {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) {
    throw new Error(`Invalid JOB_QUEUE_SCHEDULER_COMPLETED_RETENTION_HOURS: ${hours}`);
  }
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

type TerminalTimeFilter = {
  OR: Array<
    | { completedAt: { lt: Date; not: null } }
    | { completedAt: null; updatedAt: { lt: Date } }
  >;
};

function terminalOlderThan(cutoff: Date): TerminalTimeFilter {
  return {
    OR: [
      { completedAt: { lt: cutoff, not: null } },
      { completedAt: null, updatedAt: { lt: cutoff } },
    ],
  };
}

function rowTerminalTimestamp(row: {
  completedAt: Date | null;
  updatedAt: Date;
}): Date {
  return row.completedAt ?? row.updatedAt;
}

export function isRowOlderThanCutoff(
  row: { completedAt: Date | null; updatedAt: Date },
  cutoff: Date,
): boolean {
  return rowTerminalTimestamp(row).getTime() < cutoff.getTime();
}

/** Test hook: choose terminal row ids eligible for deletion at cutoff. */
export function selectTerminalRowIdsForPrune(
  rows: Array<{ id: string; completedAt: Date | null; updatedAt: Date }>,
  cutoff: Date,
  limit: number,
): string[] {
  return rows
    .filter((row) => isRowOlderThanCutoff(row, cutoff))
    .slice(0, limit)
    .map((row) => row.id);
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
  const schedulerCompletedCutoff = cutoffFromHours(retention.schedulerCompletedRetentionHours);
  const normalCompletedCutoff = cutoffFromDays(retention.completedRetentionDays);
  const failedCutoff = cutoffFromDays(retention.failedRetentionDays);

  let examined = 0;
  let schedulerCompletedDeleted = 0;
  let normalCompletedDeleted = 0;
  let failedDeleted = 0;
  let batches = 0;
  const errors: string[] = [];

  const pruneCompletedSlice = async (
    cutoff: Date,
    slice: "scheduler" | "normal",
  ) => {
    const schedulerTypes = [...PROCESS_DUE_JOBS_SCHEDULER_JOB_TYPES];
    for (let i = 0; i < retention.maxBatchesPerRun; i += 1) {
      const jobTypeFilter =
        scope?.jobType != null
          ? { jobType: scope.jobType }
          : slice === "scheduler"
            ? { jobType: { in: schedulerTypes } }
            : { jobType: { notIn: schedulerTypes } };
      const idFilter = scope?.idPrefix ? { id: { startsWith: scope.idPrefix } } : {};

      const raw = await prisma.jobQueue.findMany({
        where: {
          status: "completed",
          ...jobTypeFilter,
          ...idFilter,
        },
        select: { id: true, completedAt: true, updatedAt: true },
        orderBy: [{ completedAt: "asc" }, { updatedAt: "asc" }],
        take: retention.batchSize * 8,
      });
      const candidates = raw
        .filter((row) => isRowOlderThanCutoff(row, cutoff))
        .slice(0, retention.batchSize);
      if (!candidates.length) break;
      examined += candidates.length;
      batches += 1;
      const ids = candidates.map((r) => r.id);
      try {
        const deleted = await prisma.jobQueue.deleteMany({
          where: {
            id: { in: ids },
            status: "completed",
            ...jobTypeFilter,
            ...idFilter,
          },
        });
        if (slice === "scheduler") schedulerCompletedDeleted += deleted.count;
        else normalCompletedDeleted += deleted.count;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`completed:${slice}:${message}`);
        break;
      }
      if (candidates.length < retention.batchSize) break;
    }
  };

  const pruneFailed = async () => {
    for (let i = 0; i < retention.maxBatchesPerRun; i += 1) {
      const idFilter = scope?.idPrefix ? { id: { startsWith: scope.idPrefix } } : {};
      const rawFailed = await prisma.jobQueue.findMany({
        where: {
          status: "failed",
          ...(scope?.jobType ? { jobType: scope.jobType } : {}),
          ...idFilter,
        },
        select: { id: true, completedAt: true, updatedAt: true },
        orderBy: [{ completedAt: "asc" }, { updatedAt: "asc" }],
        take: retention.batchSize * 8,
      });
      const candidates = rawFailed
        .filter((row) => isRowOlderThanCutoff(row, failedCutoff))
        .slice(0, retention.batchSize);
      if (!candidates.length) break;
      examined += candidates.length;
      batches += 1;
      const ids = candidates.map((r) => r.id);
      try {
        const deleted = await prisma.jobQueue.deleteMany({
          where: {
            id: { in: ids },
            status: "failed",
            ...(scope?.jobType ? { jobType: scope.jobType } : {}),
            ...idFilter,
          },
        });
        failedDeleted += deleted.count;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`failed:${message}`);
        break;
      }
      if (candidates.length < retention.batchSize) break;
    }
  };

  await pruneCompletedSlice(schedulerCompletedCutoff, "scheduler");
  await pruneCompletedSlice(normalCompletedCutoff, "normal");
  await pruneFailed();

  return {
    examined,
    schedulerCompletedDeleted,
    normalCompletedDeleted,
    completedDeleted: schedulerCompletedDeleted + normalCompletedDeleted,
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
    completedScheduler: number;
    completedNormal: number;
  };
  oldestActionable: {
    id: string;
    jobType: string;
    status: JobQueueStatus;
    runAfter: string;
    createdAt: string;
    ageMinutes: number;
  } | null;
  terminalSchedulerCompletedOlderThanRetention: number;
  terminalNormalCompletedOlderThanRetention: number;
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
  const schedulerCompletedCutoff = cutoffFromHours(retention.schedulerCompletedRetentionHours);
  const normalCompletedCutoff = cutoffFromDays(retention.completedRetentionDays);
  const failedCutoff = cutoffFromDays(retention.failedRetentionDays);
  const schedulerTypes = [...PROCESS_DUE_JOBS_SCHEDULER_JOB_TYPES];

  const [all, actionable, completed, failed, processing, completedScheduler, completedNormal] =
    await Promise.all([
      prisma.jobQueue.count(),
      prisma.jobQueue.count({ where: { status: { in: JOB_QUEUE_ACTIONABLE_STATUSES } } }),
      prisma.jobQueue.count({ where: { status: "completed" } }),
      prisma.jobQueue.count({ where: { status: "failed" } }),
      prisma.jobQueue.count({ where: { status: "processing" } }),
      prisma.jobQueue.count({
        where: { status: "completed", jobType: { in: schedulerTypes } },
      }),
      prisma.jobQueue.count({
        where: { status: "completed", jobType: { notIn: schedulerTypes } },
      }),
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

  const [schedulerCompletedPrunable, normalCompletedPrunable, failedPrunable] = await Promise.all([
    prisma.jobQueue.count({
      where: {
        status: "completed",
        jobType: { in: schedulerTypes },
        ...terminalOlderThan(schedulerCompletedCutoff),
      },
    }),
    prisma.jobQueue.count({
      where: {
        status: "completed",
        jobType: { notIn: schedulerTypes },
        ...terminalOlderThan(normalCompletedCutoff),
      },
    }),
    prisma.jobQueue.count({
      where: {
        status: "failed",
        ...terminalOlderThan(failedCutoff),
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
    totals: {
      all,
      actionable,
      completed,
      failed,
      processing,
      completedScheduler,
      completedNormal,
    },
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
    terminalSchedulerCompletedOlderThanRetention: schedulerCompletedPrunable,
    terminalNormalCompletedOlderThanRetention: normalCompletedPrunable,
    terminalFailedOlderThanRetention: failedPrunable,
    retention,
    bullmq,
  };
}

export { isProcessDueJobsSchedulerJobType };

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
        terminalSchedulerCompletedOlderThanRetention:
          health.terminalSchedulerCompletedOlderThanRetention,
        terminalNormalCompletedOlderThanRetention: health.terminalNormalCompletedOlderThanRetention,
        terminalFailedOlderThanRetention: health.terminalFailedOlderThanRetention,
      },
    }),
  );
  return { ...result, health };
}
