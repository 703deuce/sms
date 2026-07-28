import { JobDeferredError } from "@/lib/messaging/types";
import { claimDueJobs, completeJob, enqueueJob, failJob } from "@/lib/messaging/enqueue-advance";
import { advanceMessagingRegistration } from "@/lib/messaging/registration-processor";
import { processCampaignSendBatch } from "@/lib/campaigns/campaign-processor";
import { sendCampaignMessageById } from "@/lib/campaigns/campaign-message-send";

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
      return sendCampaignMessageById(messageId);
    }
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

/** Drain due DB jobs (used by cron `/api/jobs/process` and worker). */
export async function processDueJobs(limit = 25) {
  // Ensure a per-minute campaign drain exists
  const minuteKey = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  await enqueueJob({
    jobType: "campaign_send_batch",
    queueName: "review-campaign",
    payload: { minuteKey },
    idempotencyKey: `campaign-send-batch:${minuteKey}`,
  });

  const claimed = await claimDueJobs(limit);
  const results: Array<{ id: string; jobType: string; ok: boolean; error?: string }> = [];

  for (const job of claimed) {
    try {
      const payload = (job.payload || {}) as Record<string, unknown>;
      await handleJob(job.jobType, payload);
      await completeJob(job.id);
      results.push({ id: job.id, jobType: job.jobType, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const deferMs = err instanceof JobDeferredError ? err.deferMs : undefined;
      await failJob(job.id, message, deferMs);
      results.push({ id: job.id, jobType: job.jobType, ok: false, error: message });
    }
  }

  return { processed: results.length, results };
}
