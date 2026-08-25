import { JobFailedError } from "@/lib/messaging/types";
import { claimDueJobs, completeJob, enqueueJob, failJob } from "@/lib/messaging/enqueue-advance";
import { advanceMessagingRegistration } from "@/lib/messaging/registration-processor";

function archivedJob(jobType: string): never {
  throw new JobFailedError(`Job type archived (MCTB-only production): ${jobType}`);
}

const MCTB_JOB_TYPES = new Set([
  "messaging_registration_advance",
  "voice_webhook_process",
  "voice_post_call",
  "john_mctb_send",
  "mctb_trial_lifecycle",
  "mctb_provider_reconciliation",
  "notification_digest",
  "voice_webhook_dlq_reprocess",
]);

export async function handleJob(jobType: string, payload: Record<string, unknown>) {
  if (!MCTB_JOB_TYPES.has(jobType)) {
    archivedJob(jobType);
  }

  switch (jobType) {
    case "messaging_registration_advance": {
      const workspaceId = String(payload.workspaceId || "");
      if (!workspaceId) throw new Error("workspaceId required");
      await advanceMessagingRegistration(workspaceId);
      return { ok: true };
    }
    case "voice_webhook_process": {
      const { processVoiceWebhookEvent } = await import("@/lib/voice/telnyx/webhook-handlers");
      return processVoiceWebhookEvent({
        providerEventId: String(payload.providerEventId || ""),
        eventType: String(payload.eventType || ""),
        workspaceId: payload.workspaceId as string | undefined,
        callId: payload.callId as string | undefined,
        humanCallId: payload.humanCallId as string | undefined,
        isHuman: Boolean(payload.isHuman),
        eventPayload: (payload.eventPayload as Record<string, unknown>) || {},
      });
    }
    case "voice_post_call": {
      const { processPostCall } = await import("@/lib/voice/post-call");
      const callId = String(payload.callId || "");
      if (!callId) throw new Error("callId required");
      return processPostCall(callId);
    }
    case "john_mctb_send": {
      const { executeMissedCallTextSend } = await import(
        "@/lib/agents/missed-call-text-back/send"
      );
      const workspaceId = String(payload.workspaceId || "");
      const missedCallEventId = String(payload.missedCallEventId || "");
      const traceId = String(payload.traceId || "");
      if (!workspaceId || !missedCallEventId) {
        throw new Error("workspaceId and missedCallEventId required");
      }
      return executeMissedCallTextSend({ workspaceId, missedCallEventId, traceId });
    }
    case "notification_digest": {
      const { processNotificationDigests } = await import("@/lib/notifications/digest");
      return processNotificationDigests(String(payload.frequency || "daily"));
    }
    case "voice_webhook_dlq_reprocess": {
      const { processVoiceWebhookEvent } = await import("@/lib/voice/telnyx/webhook-handlers");
      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      const failed = await prisma.providerWebhookEvent.findMany({
        where: { status: "failed", eventType: { startsWith: "voice." } },
        orderBy: { createdAt: "asc" },
        take: Number(payload.limit || 25),
      });
      let ok = 0;
      for (const ev of failed) {
        try {
          await processVoiceWebhookEvent({
            providerEventId: ev.providerEventId,
            eventType: ev.eventType,
            workspaceId: ev.workspaceId || undefined,
            eventPayload: (ev.payload as Record<string, unknown>) || {},
          });
          ok += 1;
        } catch {
          // leave failed
        }
      }
      return { reprocessed: ok, scanned: failed.length };
    }
    case "mctb_trial_lifecycle": {
      const { runMctbNumberLifecycleJobs } = await import("@/lib/mctb/onboarding/number-lifecycle");
      return runMctbNumberLifecycleJobs(Number(payload.limit || 50));
    }
    case "mctb_provider_reconciliation": {
      const { reconcileTwilioTollFreeInventory } = await import(
        "@/lib/mctb/admin/provider-reconciliation"
      );
      return reconcileTwilioTollFreeInventory(Number(payload.limit || 100));
    }
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

/** Drain due DB jobs (used by cron `/api/jobs/process` and worker). */
export async function processDueJobs(limit = 25) {
  const hourKey = new Date().toISOString().slice(0, 13);
  const dayKey = new Date().toISOString().slice(0, 10);

  await enqueueJob({
    jobType: "mctb_trial_lifecycle",
    queueName: "maintenance",
    payload: { hourKey, limit: 50 },
    idempotencyKey: `mctb-trial-lifecycle:${hourKey}`,
  });

  await enqueueJob({
    jobType: "mctb_provider_reconciliation",
    queueName: "maintenance",
    payload: { dayKey, limit: 100 },
    idempotencyKey: `mctb-provider-reconciliation:${dayKey}`,
  });

  await enqueueJob({
    jobType: "notification_digest",
    queueName: "maintenance",
    payload: { dayKey, frequency: "daily" },
    idempotencyKey: `notification-digest:daily:${dayKey}`,
  });

  const jobs = await claimDueJobs(limit);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const job of jobs) {
    try {
      const result = await handleJob(job.jobType, (job.payload as Record<string, unknown>) || {});
      await completeJob(job.id);
      results.push({ id: job.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failJob(job.id, message);
      results.push({ id: job.id, ok: false, error: message });
    }
  }

  return { processed: results.length, results };
}

export { claimDueJobs, completeJob, enqueueJob, failJob };
