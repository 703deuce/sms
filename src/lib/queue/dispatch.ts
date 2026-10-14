import { after } from "next/server";
import { enqueueJob as transovoEnqueueJob } from "@/lib/messaging/enqueue-advance";
import { handleJob } from "@/lib/jobs/job-handlers";
import { jobTypeToQueue } from "@/lib/queue/job-handlers";
import type { EnqueueJobInput, EnqueueJobResult, JobPriorityClass } from "@/lib/queue/types";
import { PRIORITY_SCORES } from "@/lib/queue/types";
import { logger } from "@/lib/observability/logger";

export type DispatchFeatureJobInput = {
  jobType: string;
  payload: Record<string, unknown>;
  organizationId?: string | null;
  businessId?: string | null;
  parentJobId?: string | null;
  relatedResourceId?: string | null;
  initiatedByUserId?: string | null;
  idempotencyKey?: string | null;
  priority?: JobPriorityClass | number;
  delayMs?: number;
  maxAttempts?: number;
  /** When true, database driver kicks Next.js after() immediately. Default true. */
  kickImmediately?: boolean;
};

function resolvePriority(priority?: JobPriorityClass | number): number {
  if (typeof priority === "number" && Number.isFinite(priority)) return priority;
  if (priority === "highest" || priority === "normal" || priority === "lower") {
    return PRIORITY_SCORES[priority];
  }
  return PRIORITY_SCORES.normal;
}

export function resolveQueueDriver(): "database" | "bullmq" {
  return process.env.QUEUE_DRIVER === "bullmq" && process.env.REDIS_URL ? "bullmq" : "database";
}

/**
 * Enqueue durable Reviews / reputation work on Transovo JobQueue (Prisma).
 * Replaces legacy Supabase job_queue ledger for feature APIs.
 */
export async function dispatchFeatureJob(
  input: DispatchFeatureJobInput
): Promise<EnqueueJobResult> {
  const queueName = jobTypeToQueue(input.jobType);
  const workspaceId = (input.businessId || input.organizationId || undefined)?.trim() || undefined;
  const payload = {
    ...input.payload,
    organizationId: input.organizationId ?? undefined,
    businessId: input.businessId ?? undefined,
    parentJobId: input.parentJobId ?? undefined,
    relatedResourceId: input.relatedResourceId ?? undefined,
    initiatedByUserId: input.initiatedByUserId ?? undefined,
  };

  const job = await transovoEnqueueJob({
    jobType: input.jobType,
    queueName,
    workspaceId,
    payload,
    idempotencyKey: input.idempotencyKey ?? undefined,
    runAfter: input.delayMs ? new Date(Date.now() + input.delayMs) : undefined,
    maxAttempts: input.maxAttempts,
    priority: resolvePriority(input.priority),
  });

  const driver = resolveQueueDriver();
  const reused = false;

  logger.info("dispatch_feature_job_enqueued", {
    jobType: input.jobType,
    queueName,
    jobId: job.id,
    driver,
    workspaceId,
    kickImmediately: input.kickImmediately !== false,
  });

  if (driver === "database" && input.kickImmediately !== false) {
    after(async () => {
      try {
        await handleJob(input.jobType, payload);
        const { completeJob } = await import("@/lib/messaging/enqueue-advance");
        await completeJob(job.id).catch(() => undefined);
      } catch (err) {
        const { failJob } = await import("@/lib/messaging/enqueue-advance");
        const message = err instanceof Error ? err.message : String(err);
        await failJob(job.id, message).catch(() => undefined);
        logger.error("dispatch_after_failed", {
          jobId: job.id,
          jobType: input.jobType,
          error: message,
        });
      }
    });
  }

  return {
    jobId: job.id,
    queueName,
    driver,
    enqueueState: "enqueued",
    reused,
    status: job.status,
  };
}

/** @deprecated Use transovo enqueue types at call sites when possible. */
export type { EnqueueJobInput };
