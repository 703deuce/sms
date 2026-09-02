import "server-only";

import { claimDueJobs, completeJob, enqueueJob, failJob } from "@/lib/messaging/enqueue-advance";
import { handleJob } from "@/lib/jobs/job-handlers";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";

/** Job types drained by the dedicated SMS dispatch worker container. */
export const SMS_WORKER_JOB_TYPES = [
  "send_campaign_sms",
  "send_campaign_email",
  "campaign_send_batch",
  "messaging_registration_advance",
  "drip_campaign_step",
] as const;

export type SmsWorkerJobType = (typeof SMS_WORKER_JOB_TYPES)[number];

export function isSmsWorkerJobType(jobType: string): jobType is SmsWorkerJobType {
  return (SMS_WORKER_JOB_TYPES as readonly string[]).includes(jobType);
}

/** Enqueue the per-minute campaign dispatch batch (idempotent). */
export async function enqueueCampaignSendBatchTick() {
  const minuteKey = new Date().toISOString().slice(0, 16);
  return enqueueJob({
    jobType: "campaign_send_batch",
    queueName: "review-campaign",
    payload: { minuteKey },
    idempotencyKey: `campaign-send-batch:${minuteKey}`,
  });
}

/**
 * Drain SMS-related DB jobs only. Safe to run in a dedicated worker replica;
 * claiming uses CAS updateMany so multiple replicas do not double-process.
 */
export async function processSmsWorkerDueJobs(limit = 40) {
  if (process.env.QUEUE_DRIVER === "bullmq" && process.env.REDIS_URL) {
    const { syncDbOutboxToBullmq } = await import("@/lib/jobs/bullmq");
    const outbox = await syncDbOutboxToBullmq(50);
    return {
      processed: 0,
      results: [] as Array<{ id: string; jobType: string; ok: boolean; error?: string }>,
      mode: "bullmq" as const,
      outbox,
    };
  }

  await enqueueCampaignSendBatchTick();

  const results: Array<{ id: string; jobType: string; ok: boolean; error?: string }> = [];

  for (let round = 0; round < 4; round += 1) {
    const claimed = await claimDueJobs(limit, {
      jobTypes: [...SMS_WORKER_JOB_TYPES],
    });
    if (!claimed.length) break;

    for (const job of claimed) {
      try {
        const payload = (job.payload || {}) as Record<string, unknown>;
        await handleJob(job.jobType, payload);
        await completeJob(job.id);
        results.push({ id: job.id, jobType: job.jobType, ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof JobFailedError) {
          await failJob(job.id, message, undefined, undefined, true);
          results.push({ id: job.id, jobType: job.jobType, ok: false, error: message });
          continue;
        }
        const deferMs = err instanceof JobDeferredError ? err.deferMs : undefined;
        const soft = err instanceof JobDeferredError ? err.soft : false;
        await failJob(job.id, message, deferMs, soft);
        results.push({ id: job.id, jobType: job.jobType, ok: false, error: message });
      }
    }
  }

  return { processed: results.length, results, mode: "db" as const };
}
