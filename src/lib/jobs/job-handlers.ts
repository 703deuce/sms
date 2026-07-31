import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";
import { claimDueJobs, completeJob, enqueueJob, failJob } from "@/lib/messaging/enqueue-advance";
import { advanceMessagingRegistration } from "@/lib/messaging/registration-processor";
import { processCampaignSendBatch } from "@/lib/campaigns/campaign-processor";
import { sendCampaignMessageById } from "@/lib/campaigns/campaign-message-send";
import {
  processActiveAutomations,
  processAutomationTick,
} from "@/lib/automations/processor";

export async function handleJob(jobType: string, payload: Record<string, unknown>) {
  switch (jobType) {
    case "messaging_registration_advance": {
      const workspaceId = String(payload.workspaceId || "");
      if (!workspaceId) throw new Error("workspaceId required");
      await advanceMessagingRegistration(workspaceId);
      return { ok: true };
    }
    case "campaign_send_batch": {
      return processCampaignSendBatch();
    }
    case "send_campaign_sms":
    case "send_campaign_email": {
      const messageId = String(payload.messageId || "");
      if (!messageId) throw new Error("messageId required");
      const result = await sendCampaignMessageById(messageId);
      // Soft deferrals must not complete the job (BullMQ would drop re-enqueue by jobId)
      if (result && typeof result === "object" && "deferred" in result && (result as { deferred?: boolean }).deferred) {
        const reason = String((result as { reason?: string }).reason || "deferred");
        throw new JobDeferredError(`send_deferred:${reason}`, 60_000);
      }
      return result;
    }
    case "automation_advance": {
      const executionId = String(payload.executionId || "");
      if (!executionId) throw new Error("executionId required");
      const { advanceAutomationExecution } = await import("@/lib/automations/runner");
      return advanceAutomationExecution(executionId);
    }
    case "automation_tick": {
      const flowId = String(payload.flowId || "");
      const workspaceId = String(payload.workspaceId || "");
      if (!flowId || !workspaceId) throw new Error("flowId and workspaceId required");
      return processAutomationTick(flowId, workspaceId);
    }
    case "automation_batch": {
      return processActiveAutomations();
    }
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

/** Drain due DB jobs (used by cron `/api/jobs/process` and worker). */
export async function processDueJobs(limit = 25) {
  const minuteKey = new Date().toISOString().slice(0, 16);
  await enqueueJob({
    jobType: "campaign_send_batch",
    queueName: "review-campaign",
    payload: { minuteKey },
    idempotencyKey: `campaign-send-batch:${minuteKey}`,
  });
  await enqueueJob({
    jobType: "automation_batch",
    queueName: "automations",
    payload: { minuteKey },
    idempotencyKey: `automation-batch:${minuteKey}`,
  });

  // When BullMQ is the consumer, cron enqueues the minute batch and re-syncs the DB outbox.
  // Do not claim/process DB jobs locally — that would double-send with workers.
  if (process.env.QUEUE_DRIVER === "bullmq" && process.env.REDIS_URL) {
    const { syncDbOutboxToBullmq } = await import("@/lib/jobs/bullmq");
    const outbox = await syncDbOutboxToBullmq(50);
    return {
      processed: 0,
      results: [] as Array<{ id: string; jobType: string; ok: boolean; error?: string }>,
      mode: "bullmq",
      outbox,
    };
  }

  const results: Array<{ id: string; jobType: string; ok: boolean; error?: string }> = [];

  // Multiple rounds so campaign_send_batch can enqueue sends that we drain in the same tick
  for (let round = 0; round < 4; round += 1) {
    const claimed = await claimDueJobs(limit);
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

  return { processed: results.length, results, mode: "db" };
}
