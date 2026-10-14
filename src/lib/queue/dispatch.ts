import { after } from "next/server";
import { enqueueJob, resolveQueueDriver } from "@/lib/queue/service";
import { processQueueJob } from "@/lib/queue/processors";
import { jobTypeToQueue } from "@/lib/queue/job-handlers";
import type { EnqueueJobInput, EnqueueJobResult, JobPriorityClass } from "@/lib/queue/types";
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

/**
 * Enqueue durable work and kick the correct execution path.
 * Feature APIs should return after this — never await heavy provider work.
 */
export async function dispatchFeatureJob(
  input: DispatchFeatureJobInput
): Promise<EnqueueJobResult> {
  const queueName = jobTypeToQueue(input.jobType);
  const enqueueInput: EnqueueJobInput = {
    queueName,
    jobType: input.jobType,
    payload: input.payload,
    organizationId: input.organizationId,
    businessId: input.businessId,
    parentJobId: input.parentJobId,
    relatedResourceId: input.relatedResourceId,
    initiatedByUserId: input.initiatedByUserId,
    idempotencyKey: input.idempotencyKey,
    priority: input.priority ?? "normal",
    delayMs: input.delayMs,
    maxAttempts: input.maxAttempts,
  };

  const result = await enqueueJob(enqueueInput);
  const driver = resolveQueueDriver();

  logger.info("dispatch_feature_job_enqueued", {
    jobType: input.jobType,
    queueName,
    jobId: result.jobId,
    enqueueState: result.enqueueState,
    driver: result.driver,
    reused: result.reused,
    kickImmediately: input.kickImmediately !== false,
    organizationId: input.organizationId,
    businessId: input.businessId,
  });

  if (
    driver === "database" &&
    input.kickImmediately !== false &&
    result.enqueueState === "enqueued" &&
    !result.reused
  ) {
    after(async () => {
      try {
        await processQueueJob(queueName, {
          ledgerJobId: result.jobId,
          jobId: result.jobId,
          ...input.payload,
          organizationId: input.organizationId ?? undefined,
          businessId: input.businessId ?? undefined,
        });
      } catch (err) {
        logger.error("dispatch_after_failed", {
          jobId: result.jobId,
          jobType: input.jobType,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return result;
}
