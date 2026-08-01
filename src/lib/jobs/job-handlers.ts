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
    case "voice_campaign_batch": {
      const { processVoiceCampaignBatch } = await import("@/lib/voice/call-service");
      return processVoiceCampaignBatch();
    }
    case "voice_mock_call_complete": {
      const { completeMockCall } = await import("@/lib/voice/call-service");
      const callId = String(payload.callId || "");
      if (!callId) throw new Error("callId required");
      return completeMockCall(callId);
    }
    case "voice_recording_ingest": {
      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      const callId = String(payload.callId || "");
      const workspaceId = String(payload.workspaceId || "");
      if (!callId) throw new Error("callId required");
      const urls = payload.recordingUrl as Record<string, string> | undefined;
      const storageUrl = urls?.mp3 || urls?.wav || null;
      await prisma.voiceRecording.create({
        data: {
          workspaceId,
          callId,
          provider: "telnyx",
          status: "ready",
          storageUrl,
          providerRecordingId: String(payload.providerRecordingId || ""),
          channels: 2,
        },
      });
      if (storageUrl) {
        const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
        const { publishRecordingReady } = await import("@/lib/crm/events");
        await publishRecordingReady({
          workspaceId,
          contactId: call?.contactId || null,
          callId,
          recordingUrl: storageUrl,
          direction:
            call?.direction === "OUTBOUND" || call?.direction === "outbound"
              ? "outbound"
              : "inbound",
        }).catch(() => undefined);
      }
      return { ok: true };
    }
    case "voice_tool_execute": {
      const { executeVoiceTool } = await import("@/lib/voice/tools/executor");
      return executeVoiceTool(payload as import("@/lib/voice/tools/executor").ToolExecInput);
    }
    case "voice_knowledge_process": {
      const { processKnowledgeSource } = await import("@/lib/voice/knowledge-processor");
      const sourceId = String(payload.sourceId || "");
      if (!sourceId) throw new Error("sourceId required");
      return processKnowledgeSource(sourceId);
    }
    case "list_cleanup": {
      const workspaceId = payload.workspaceId as string | undefined;
      const { runListCleanup, runListCleanupAllWorkspaces } = await import("@/lib/contacts/cleanup-list");
      if (workspaceId) {
        return runListCleanup(workspaceId);
      }
      return runListCleanupAllWorkspaces();
    }
    case "campaign_recurrence_tick": {
      const { tickRecurringCampaigns } = await import("@/lib/campaigns/recurrence");
      return tickRecurringCampaigns();
    }
    case "notification_digest": {
      const { processNotificationDigests } = await import("@/lib/notifications/digest");
      const frequency = String(payload.frequency || "daily");
      return processNotificationDigests(frequency);
    }
    case "crm_sync": {
      const { runCrmSyncJob } = await import("@/lib/crm/sync-engine");
      return runCrmSyncJob({
        workspaceId: String(payload.workspaceId || ""),
        provider: payload.provider as "salesforce" | "zoho" | "pipedrive",
        syncRunId: String(payload.syncRunId || ""),
        kind: payload.kind as
          | "initial"
          | "incremental"
          | "manual"
          | "webhook"
          | "scheduled"
          | "push"
          | undefined,
      });
    }
    case "crm_push_event": {
      const { pushCrmEventJob } = await import("@/lib/crm/push");
      return pushCrmEventJob({
        workspaceId: String(payload.workspaceId || ""),
        provider: payload.provider as "salesforce" | "zoho" | "pipedrive",
        event: payload.event as import("@/lib/crm/types").CrmPlatformEvent,
      });
    }
    case "crm_metadata_refresh": {
      const { runCrmMetadataRefreshJob } = await import("@/lib/crm/runtime/metadata-refresh");
      return runCrmMetadataRefreshJob({
        workspaceId: String(payload.workspaceId || ""),
        provider: payload.provider as "salesforce" | "zoho" | "pipedrive",
      });
    }
    case "crm_bulk_sync": {
      const { runCrmBulkSyncPage } = await import("@/lib/crm/runtime/bulk-sync");
      return runCrmBulkSyncPage({
        workspaceId: String(payload.workspaceId || ""),
        provider: payload.provider as "salesforce" | "zoho" | "pipedrive",
        syncRunId: String(payload.syncRunId || ""),
        objectType: (payload.objectType as "contact" | "company" | "lead") || "contact",
        cursor: (payload.cursor as string | null) || null,
      });
    }
    case "crm_webhook_process": {
      const { processCrmWebhookJob } = await import("@/lib/crm/runtime/webhooks");
      return processCrmWebhookJob({
        workspaceId: String(payload.workspaceId || ""),
        provider: payload.provider as "salesforce" | "zoho" | "pipedrive",
        webhookEventId: String(payload.webhookEventId || ""),
      });
    }
    case "crm_scheduled_incremental": {
      const { enqueueScheduledCrmIncrementalSyncs } = await import("@/lib/crm/scheduled-sync");
      return enqueueScheduledCrmIncrementalSyncs();
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
  await enqueueJob({
    jobType: "voice_campaign_batch",
    queueName: "voice-calls",
    payload: { minuteKey },
    idempotencyKey: `voice-campaign-batch:${minuteKey}`,
  });

  const dayKey = new Date().toISOString().slice(0, 10);
  await enqueueJob({
    jobType: "list_cleanup",
    queueName: "maintenance",
    payload: { dayKey },
    idempotencyKey: `list-cleanup:${dayKey}`,
  });
  await enqueueJob({
    jobType: "notification_digest",
    queueName: "maintenance",
    payload: { dayKey, frequency: "daily" },
    idempotencyKey: `notification-digest:daily:${dayKey}`,
  });
  await enqueueJob({
    jobType: "campaign_recurrence_tick",
    queueName: "review-campaign",
    payload: { minuteKey },
    idempotencyKey: `campaign-recurrence:${minuteKey}`,
  });

  // Hourly CRM incremental reconcile across connected workspaces (complements webhooks).
  const hourKey = new Date().toISOString().slice(0, 13);
  await enqueueJob({
    jobType: "crm_scheduled_incremental",
    queueName: "crm-salesforce",
    payload: { hourKey },
    idempotencyKey: `crm-scheduled-tick:${hourKey}`,
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
