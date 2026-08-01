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
      await prisma.voiceRecording.create({
        data: {
          workspaceId,
          callId,
          provider: "telnyx",
          status: "ready",
          storageUrl: urls?.mp3 || urls?.wav || null,
          providerRecordingId: String(payload.providerRecordingId || ""),
          channels: 2,
        },
      });
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
    case "phone_queue_overflow": {
      const { handleQueueOverflowJob } = await import("@/lib/phone/queue-runtime");
      return handleQueueOverflowJob({
        workspaceId: String(payload.workspaceId || ""),
        queueId: String(payload.queueId || ""),
        humanCallId: String(payload.humanCallId || ""),
        telnyxCallControlId: String(payload.telnyxCallControlId || ""),
      });
    }
    case "phone_park_timeout": {
      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      const slotId = String(payload.slotId || "");
      const slot = await prisma.callParkSlot.findUnique({ where: { id: slotId } });
      if (!slot || slot.status !== "parked") return { skipped: true };
      await prisma.callParkSlot.update({
        where: { id: slotId },
        data: { status: "timed_out" },
      });
      if (slot.telnyxCallControlId) {
        const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
        // Unhold before transfer/voicemail so the held leg can accept media actions.
        await telnyxRequest(`/calls/${slot.telnyxCallControlId}/actions/unhold`, {
          method: "POST",
          body: {},
        }).catch(() => undefined);
        if (slot.fallbackTarget) {
          await telnyxRequest(`/calls/${slot.telnyxCallControlId}/actions/transfer`, {
            method: "POST",
            body: { to: slot.fallbackTarget },
          }).catch(() => undefined);
        } else if (slot.humanCallId) {
          const { leaveVoicemailOnCall } = await import("@/lib/phone/voicemail-service");
          await leaveVoicemailOnCall({
            workspaceId: slot.workspaceId,
            humanCallId: slot.humanCallId,
            telnyxCallControlId: slot.telnyxCallControlId,
          }).catch(() => undefined);
        }
      }
      if (slot.humanCallId) {
        await prisma.humanCall.update({
          where: { id: slot.humanCallId },
          data: {
            onHold: false,
            parkSlotId: null,
            status: slot.fallbackTarget ? "transferred" : "voicemail",
            disposition: slot.fallbackTarget
              ? `park_timeout:${slot.fallbackTarget}`
              : "park_timeout_voicemail",
          },
        }).catch(() => undefined);
      }
      return { ok: true, slotId };
    }
    case "voice_human_first_timeout": {
      const { handleHumanFirstTimeoutJob } = await import("@/lib/voice/inbound");
      return handleHumanFirstTimeoutJob({
        workspaceId: String(payload.workspaceId || ""),
        callId: String(payload.callId || ""),
        humanCallId: payload.humanCallId as string | undefined,
        telnyxCallControlId: payload.telnyxCallControlId as string | undefined,
        agentId: payload.agentId as string | undefined,
      });
    }
    case "voice_warm_transfer_timeout": {
      const { handleWarmTransferTimeoutJob } = await import("@/lib/voice/transfers");
      return handleWarmTransferTimeoutJob({
        workspaceId: String(payload.workspaceId || ""),
        callId: String(payload.callId || ""),
        transferId: String(payload.transferId || ""),
      });
    }
    case "voice_warm_transfer_complete": {
      const { completeWarmTransfer } = await import("@/lib/voice/transfers");
      return completeWarmTransfer({
        workspaceId: String(payload.workspaceId || ""),
        callId: String(payload.callId || ""),
        transferId: String(payload.transferId || ""),
        consultControlId: String(payload.consultControlId || ""),
        callerControlId: String(payload.callerControlId || ""),
        summary: payload.summary ? String(payload.summary) : undefined,
      });
    }
    case "phone_warm_transfer_timeout": {
      const { cancelWarmTransfer } = await import("@/lib/phone/human-call-service");
      const { getPrisma } = await import("@/lib/db");
      const humanCallId = String(payload.humanCallId || "");
      const workspaceId = String(payload.workspaceId || "");
      const consultControlId = payload.consultControlId
        ? String(payload.consultControlId)
        : "";
      const call = await getPrisma().humanCall.findFirst({
        where: { id: humanCallId, workspaceId },
      });
      if (!call?.telnyxCallLegId || call.status === "transferred" || call.status === "completed") {
        return { skipped: true };
      }
      // Only cancel the original unanswered consult — not an answered consult or a later flip leg.
      if (consultControlId && call.telnyxCallLegId !== consultControlId) {
        return { skipped: true };
      }
      if ((call.notes || "").includes("[warm_consult_answered]")) {
        return { skipped: true };
      }
      if (!(call.notes || "").includes("Warm transfer")) {
        return { skipped: true };
      }
      await cancelWarmTransfer(humanCallId, workspaceId).catch(() => undefined);
      return { ok: true, cancelled: true };
    }
    case "voice_send_email": {
      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      const workspaceId = String(payload.workspaceId || "") || null;
      const to = String(payload.to || "");
      const subject = String(payload.subject || "");
      const body = String(payload.body || "");
      if (!to || !subject || !body) throw new Error("to, subject, body required");

      const pending = await prisma.message.create({
        data: {
          workspaceId,
          to,
          from: process.env.BREVO_FROM_EMAIL?.trim() || process.env.REVIEW_REQUEST_FROM_EMAIL?.trim() || "voice@noreply",
          body: `${subject}\n\n${body}`,
          status: "queued",
          providerId: `voice-email:${Date.now()}`,
        },
      });

      let sendResult: { status: string; id?: string; error?: string } = { status: "queued" };
      try {
        const { sendTransactionalEmail } = await import("@/lib/email/brevo");
        const result = await sendTransactionalEmail({
          to,
          subject,
          htmlContent: `<p>${body.replace(/\n/g, "<br>")}</p>`,
          textContent: body,
        });
        sendResult = { status: result.status, id: result.id, error: result.error };
        if (result.status === "sent" || result.status === "queued") {
          await prisma.message.update({
            where: { id: pending.id },
            data: { status: result.status, providerId: result.id },
          });
        } else if (result.status === "failed") {
          await prisma.message.update({
            where: { id: pending.id },
            data: { status: "failed", providerId: result.id },
          });
        }
      } catch (err) {
        console.warn("[voice_send_email] send failed, record kept as queued", err);
      }

      await prisma.auditLog.create({
        data: {
          workspaceId,
          event: "voice.email_queued",
          detail: JSON.stringify({ ...payload, messageId: pending.id, sendResult }),
        },
      });

      return { ok: true, queued: true, messageId: pending.id, sendResult };
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
