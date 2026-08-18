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
    case "voice_outbound_ai_call": {
      const workspaceId = String(payload.workspaceId || "");
      const agentId = String(payload.agentId || "");
      const contactId = String(payload.contactId || "");
      if (!workspaceId || !agentId || !contactId) {
        throw new Error("workspaceId, agentId, and contactId required");
      }

      // Inbound attach must never place an outbound dial — Telnyx already owns audio.
      if (payload.attachInbound === true) {
        return {
          ok: true,
          skipped: true,
          reason: "attach_inbound_no_outbound_dial",
        };
      }

      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, workspaceId },
        select: { phone: true },
      });
      if (!contact?.phone) throw new Error("contact phone required for AI call");

      let dynamicVariables: Record<string, unknown> = {};
      try {
        const raw = payload.context;
        if (typeof raw === "string" && raw.trim()) {
          dynamicVariables = JSON.parse(raw) as Record<string, unknown>;
        } else if (raw && typeof raw === "object") {
          dynamicVariables = raw as Record<string, unknown>;
        }
      } catch {
        dynamicVariables = {};
      }
      if (payload.purpose) dynamicVariables.purpose = String(payload.purpose);

      // Optional callerId may be a PhoneNumber id or E.164.
      const callerId = String(payload.callerId || "").trim();
      let fromPhoneNumberId: string | undefined;
      let fromE164: string | undefined;
      if (callerId.startsWith("+")) {
        fromE164 = callerId;
      } else if (callerId) {
        fromPhoneNumberId = callerId;
      }

      const { initiateOutboundCall } = await import("@/lib/voice/call-service");
      const { call } = await initiateOutboundCall({
        workspaceId,
        agentId,
        toPhone: contact.phone,
        contactId,
        dynamicVariables,
        fromPhoneNumberId,
        fromE164,
      });

      const executionId = String(payload.automationExecutionId || "");
      if (executionId) {
        const exec = await prisma.automationExecution.findFirst({
          where: { id: executionId, workspaceId },
          select: { metadata: true },
        });
        const meta = (exec?.metadata || {}) as Record<string, unknown>;
        await prisma.automationExecution.update({
          where: { id: executionId },
          data: {
            metadata: {
              ...meta,
              pendingCallId: call.id,
              pendingAiCallAgentId: agentId,
              callResultConsumed: false,
            },
          },
        });
      }

      return { ok: true, callId: call.id };
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
    case "voice_appointment_provider_sync": {
      const { syncAppointmentToProvider, markAppointmentSyncFailed } = await import(
        "@/lib/voice/agent-tool-gateway/provider-sync"
      );
      const workspaceId = String(payload.workspaceId || "");
      const appointmentId = String(payload.appointmentId || "");
      if (!workspaceId || !appointmentId) {
        throw new Error("workspaceId and appointmentId required");
      }
      try {
        return await syncAppointmentToProvider({
          workspaceId,
          appointmentId,
          agentId: payload.agentId ? String(payload.agentId) : null,
          callId: payload.callId ? String(payload.callId) : null,
          operationId: payload.operationId ? String(payload.operationId) : null,
        });
      } catch (err) {
        await markAppointmentSyncFailed(appointmentId, workspaceId, err).catch(() => undefined);
        throw err;
      }
    }
    case "voice_send_sms":
    case "voice_appointment_provider_cancel":
    case "voice_appointment_provider_reschedule": {
      const { processVoiceOutboxJob } = await import("@/lib/voice/outbox/voice-outbox");
      return processVoiceOutboxJob(jobType, payload as Record<string, unknown>);
    }
    case "voice_tool_execute": {
      const { executeVoiceTool } = await import("@/lib/voice/tools/executor");
      const result = await executeVoiceTool(
        payload as import("@/lib/voice/tools/executor").ToolExecInput,
      );
      // Inject async tool result into Telnyx conversation so the assistant can continue.
      try {
        const callId = String(payload.callId || "");
        if (callId && result?.ok) {
          const { getPrisma } = await import("@/lib/db");
          const call = await getPrisma().voiceCall.findUnique({ where: { id: callId } });
          const conversationId = call?.telnyxConversationId;
          if (conversationId) {
            const ai = await import("@/lib/voice/telnyx/ai-client");
            if (ai.isTelnyxAiConfigured()) {
              const text = JSON.stringify(
                (result as { output?: unknown }).output ?? { ok: true },
              ).slice(0, 4000);
              await ai.addConversationMessage(conversationId, {
                role: "tool",
                content: text,
              }).catch(() => undefined);
            }
          }
        }
      } catch {
        // best-effort injection
      }
      return result;
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
    case "phone_hunt_advance": {
      const { advanceSequentialHunt } = await import("@/lib/phone/hunt-service");
      return advanceSequentialHunt({
        workspaceId: String(payload.workspaceId || ""),
        humanCallId: String(payload.humanCallId || ""),
        telnyxCallControlId: String(payload.telnyxCallControlId || ""),
        toE164: String(payload.toE164 || ""),
      });
    }
    case "phone_queue_callback": {
      // Recorded callback request — automation / agent follow-up. No auto-dial here.
      const { getPrisma } = await import("@/lib/db");
      const humanCallId = String(payload.humanCallId || "");
      const call = await getPrisma().humanCall.findUnique({ where: { id: humanCallId } });
      if (!call) return { skipped: true };
      await getPrisma().humanCall.update({
        where: { id: humanCallId },
        data: {
          notes: `${call.notes || ""}\n[callback_due]`.trim(),
        },
      });
      return { ok: true, callbackDue: true, toE164: payload.toE164 || call.from };
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
    case "phone_softphone_ring_timeout": {
      const { getPrisma } = await import("@/lib/db");
      const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
      const { resolveForwarding } = await import("@/lib/phone/forwarding-service");
      const { leaveVoicemailOnCall } = await import("@/lib/phone/voicemail-service");
      const prisma = getPrisma();
      const humanCallId = String(payload.humanCallId || "");
      const workspaceId = String(payload.workspaceId || "");
      const controlId = String(payload.telnyxCallControlId || "");
      const toE164 = String(payload.toE164 || "");
      const call = await prisma.humanCall.findFirst({
        where: { id: humanCallId, workspaceId },
      });
      if (
        !call ||
        (call.notes || "").includes("smart_routing:") ||
        !["ringing", "queued", "initiated"].includes(call.status) ||
        ((call.notes || "").includes("screening:accepted") && call.answeredAt) ||
        (call.answeredAt && !(call.notes || "").includes("screening:"))
      ) {
        return { skipped: true };
      }
      // Hang up hunt / screening / queue cellular ring legs before overflow.
      const ringLegMatch = (call.notes || "").match(/\[ring_legs:([^\]]+)\]/);
      if (ringLegMatch?.[1]) {
        for (const legId of ringLegMatch[1]
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)) {
          await telnyxRequest(`/calls/${legId}/actions/hangup`, {
            method: "POST",
            body: {},
          }).catch(() => undefined);
        }
      }

      const personalForward =
        Boolean(payload.personalForward) || (call.notes || "").includes("[personal_forward:");
      if (personalForward && controlId) {
        const { applyPersonalForwardOverflow } = await import(
          "@/lib/numbers/personal-forward-fallback"
        );
        await applyPersonalForwardOverflow({
          workspaceId,
          humanCallId: call.id,
          telnyxCallControlId: controlId,
          toE164,
          reason: "unanswered",
        });
        return { ok: true, action: "personal_forward_overflow" };
      }

      const pn = toE164
        ? await prisma.phoneNumber.findFirst({ where: { workspaceId, e164: toE164 } })
        : null;
      const rule = await resolveForwarding({
        workspaceId,
        phoneNumberId: pn?.id,
        userId: call.agentUserId,
        unanswered: true,
      }).catch(() => null);
      if (rule?.targetType === "external" && rule.targetValue && controlId) {
        await telnyxRequest(`/calls/${controlId}/actions/unhold`, {
          method: "POST",
          body: {},
        }).catch(() => undefined);
        await telnyxRequest(`/calls/${controlId}/actions/transfer`, {
          method: "POST",
          body: { to: rule.targetValue },
        }).catch(() => undefined);
        await prisma.humanCall.update({
          where: { id: call.id },
          data: {
            status: "transferred",
            disposition: `unanswered_forward:${rule.targetValue}`,
            endedAt: new Date(),
          },
        });
        return { ok: true, action: "forward" };
      }
      if (controlId) {
        if (call.onHold || (call.notes || "").includes("screening:")) {
          await telnyxRequest(`/calls/${controlId}/actions/unhold`, {
            method: "POST",
            body: {},
          }).catch(() => undefined);
        }
        await leaveVoicemailOnCall({
          workspaceId,
          humanCallId: call.id,
          telnyxCallControlId: controlId,
          userId: call.agentUserId,
          phoneNumberId: pn?.id ?? null,
        }).catch(async () => {
          await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
            method: "POST",
            body: {},
          }).catch(() => undefined);
          await prisma.humanCall.update({
            where: { id: call.id },
            data: {
              status: "missed",
              disposition: "missed:ring_timeout",
              endedAt: new Date(),
            },
          });
        });
      } else {
        await prisma.humanCall.update({
          where: { id: call.id },
          data: {
            status: "missed",
            disposition: "missed:ring_timeout",
            endedAt: new Date(),
          },
        });
      }
      return { ok: true, action: "voicemail_or_missed" };
    }
    case "phone_announcement_hangup": {
      const controlId = String(payload.telnyxCallControlId || "");
      const humanCallId = payload.humanCallId ? String(payload.humanCallId) : null;
      if (!controlId) return { skipped: true };
      const { hangupTelnyxAnnouncementCall } = await import(
        "@/lib/numbers/personal-announcement-playback"
      );
      await hangupTelnyxAnnouncementCall(controlId, humanCallId);
      return { ok: true, action: "announcement_hangup" };
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
    case "voice_cold_transfer_timeout": {
      const { handleColdTransferTimeoutJob } = await import("@/lib/voice/transfers");
      return handleColdTransferTimeoutJob({
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
    case "crm_sync": {
      const { getMaintenanceState } = await import("@/lib/platform-flags");
      const maintenance = await getMaintenanceState().catch(() => ({ enabled: false }));
      if (maintenance?.enabled && process.env.MAINTENANCE_MODE !== "0") {
        return { ok: true, skipped: true, reason: "maintenance_mode" };
      }
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
      const { getMaintenanceState } = await import("@/lib/platform-flags");
      const maintenance = await getMaintenanceState().catch(() => ({ enabled: false }));
      if (maintenance?.enabled && process.env.MAINTENANCE_MODE !== "0") {
        // Live call/SMS CRM updates still run during maintenance unless hard-env lock.
        if (process.env.MAINTENANCE_BLOCK_CRM === "1") {
          return { ok: true, skipped: true, reason: "maintenance_mode" };
        }
      }
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
    case "crm_automation_action": {
      const { executeCrmAutomationAction } = await import("@/lib/crm/automation-actions");
      return executeCrmAutomationAction({
        workspaceId: String(payload.workspaceId || ""),
        provider: payload.provider as "salesforce" | "zoho" | "pipedrive",
        actionId: String(payload.actionId || ""),
        params: (payload.params as Record<string, unknown>) || {},
        contactId: (payload.contactId as string | null) || null,
        automationFlowId: (payload.automationFlowId as string | null) || null,
      });
    }
    case "appointment_starting_soon_scan": {
      const { scanAppointmentsStartingSoon } = await import(
        "@/lib/integrations/framework/appointment-reminders"
      );
      return scanAppointmentsStartingSoon();
    }
    case "appointment_completed_scan": {
      const { scanAppointmentsCompleted } = await import(
        "@/lib/integrations/framework/appointment-reminders"
      );
      return scanAppointmentsCompleted();
    }
    case "promote_scheduled_receptionists": {
      const { promoteScheduledReceptionists } = await import(
        "@/lib/solutions/appointment-receptionist/promote-scheduled"
      );
      return promoteScheduledReceptionists({
        workspaceId: payload.workspaceId ? String(payload.workspaceId) : undefined,
        limit: typeof payload.limit === "number" ? payload.limit : undefined,
      });
    }
    case "crm_task_due_scan": {
      const { scanCrmTasksDueAndOverdue } = await import("@/lib/crm/task-due-scan");
      return scanCrmTasksDueAndOverdue();
    }
    case "integration_sync": {
      const { runIntegrationSyncJob } = await import("@/lib/integrations/framework/sync");
      return runIntegrationSyncJob({
        workspaceId: String(payload.workspaceId || ""),
        provider: payload.provider as import("@/lib/integrations/framework").ExternalProviderId,
        syncRunId: String(payload.syncRunId || ""),
        kind: payload.kind as "initial" | "incremental" | "manual" | "webhook" | undefined,
      });
    }
    case "integration_webhook_process": {
      const { processIntegrationWebhookJob } = await import("@/lib/integrations/framework/sync");
      return processIntegrationWebhookJob({
        workspaceId: String(payload.workspaceId || ""),
        provider: payload.provider as import("@/lib/integrations/framework").ExternalProviderId,
        webhookEventId: String(payload.webhookEventId || ""),
      });
    }
    case "integration_automation_event": {
      const { dispatchIntegrationAutomationEvent } = await import(
        "@/lib/integrations/framework/automation-bridge"
      );
      return dispatchIntegrationAutomationEvent({
        workspaceId: String(payload.workspaceId || ""),
        provider: String(payload.provider || ""),
        eventType: String(payload.eventType || ""),
        contactId: (payload.contactId as string | null) || null,
        phone: (payload.phone as string | null) || null,
        email: (payload.email as string | null) || null,
        webhookEventId: (payload.webhookEventId as string | null) || null,
        payload: (payload.payload as Record<string, unknown>) || {},
      });
    }
    case "integration_action": {
      const { executeIntegrationAction } = await import(
        "@/lib/integrations/framework/actions-registry"
      );
      return executeIntegrationAction({
        workspaceId: String(payload.workspaceId || ""),
        provider: payload.provider as import("@/lib/integrations/framework").ExternalProviderId,
        actionId: payload.actionId as import("@/lib/integrations/framework/actions-registry").IntegrationActionId,
        params: (payload.params as Record<string, unknown>) || {},
        contactId: (payload.contactId as string | null) || null,
        actorUserId: (payload.actorUserId as string | null) || null,
        source: (payload.source as "human" | "ai" | "automation" | "api") || "automation",
        role: (payload.role as string | null) || null,
        approvalId: (payload.approvalId as string | null) || null,
        payloadHash: (payload.payloadHash as string | null) || null,
        automationFlowId: (payload.automationFlowId as string | null) || null,
        idempotencyKey: (payload.idempotencyKey as string | null) || null,
        connectionId: (payload.connectionId as string | null) || null,
        recordCount: typeof payload.recordCount === "number" ? payload.recordCount : 1,
      });
    }
    case "integration_context_refresh": {
      const { refreshIntegrationContextCache } = await import(
        "@/lib/integrations/framework/context-cache"
      );
      return refreshIntegrationContextCache(
        String(payload.workspaceId || ""),
        String(payload.contactId || ""),
      );
    }
    case "voice_ai_retention": {
      const { runVoiceAiRetention } = await import("@/lib/voice/platform/retention");
      return runVoiceAiRetention(
        payload.workspaceId ? String(payload.workspaceId) : undefined,
      );
    }
    case "voice_regression_suite": {
      const { runDefaultRegressionSuite } = await import(
        "@/lib/voice/platform/ai-platform"
      );
      const workspaceId = String(payload.workspaceId || "");
      if (!workspaceId) throw new Error("workspaceId required");
      const suiteName = String(payload.suiteName || "transovo-default");
      const result = await runDefaultRegressionSuite(workspaceId, suiteName);
      // True daily recurrence: schedule tomorrow when this run was marked recurring.
      if (payload.recurring === true || payload.recurring === "1") {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(6, 0, 0, 0);
        const dayKey = tomorrow.toISOString().slice(0, 10);
        await enqueueJob({
          jobType: "voice_regression_suite",
          queueName: "voice-calls",
          workspaceId,
          payload: { workspaceId, suiteName, recurring: true },
          idempotencyKey: `voice-regression:${workspaceId}:${dayKey}`,
          runAfter: tomorrow,
        });
      }
      return result;
    }
    case "voice_webhook_dlq_reprocess": {
      const { getPrisma } = await import("@/lib/db");
      const { processVoiceWebhookEvent } = await import(
        "@/lib/voice/telnyx/webhook-handlers"
      );
      const prisma = getPrisma();
      const failed = await prisma.providerWebhookEvent.findMany({
        where: {
          provider: "telnyx",
          status: "failed",
          ...(payload.workspaceId
            ? { workspaceId: String(payload.workspaceId) }
            : {}),
        },
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
    case "integration_health_scan": {
      const { scanIntegrationHealth } = await import("@/lib/integrations/framework/alerts");
      return scanIntegrationHealth(String(payload.workspaceId || ""));
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
  // Neutral queue — must not depend on Salesforce being deployed.
  const hourKey = new Date().toISOString().slice(0, 13);
  await enqueueJob({
    jobType: "crm_scheduled_incremental",
    queueName: "maintenance",
    payload: { hourKey },
    idempotencyKey: `crm-scheduled-tick:${hourKey}`,
  });

  // Calendly / appointment "starting soon" automation windows (every minute drain).
  await enqueueJob({
    jobType: "appointment_starting_soon_scan",
    queueName: "maintenance",
    payload: { minuteKey },
    idempotencyKey: `appt-starting-soon:${minuteKey}`,
  });

  // Calendly / appointment "completed" automation events (every minute drain).
  await enqueueJob({
    jobType: "appointment_completed_scan",
    queueName: "maintenance",
    payload: { minuteKey },
    idempotencyKey: `appt-completed:${minuteKey}`,
  });

  // Scheduled receptionist activation (wizard activationMode=schedule).
  await enqueueJob({
    jobType: "promote_scheduled_receptionists",
    queueName: "maintenance",
    payload: { minuteKey },
    idempotencyKey: `promote-scheduled-receptionists:${minuteKey}`,
  });

  // CRM task due / overdue automation windows (every minute drain).
  await enqueueJob({
    jobType: "crm_task_due_scan",
    queueName: "maintenance",
    payload: { minuteKey },
    idempotencyKey: `crm-task-due:${minuteKey}`,
  });

  // Daily voice AI retention + DLQ sweep (workspace-scoped jobs still scheduled per-tenant).
  await enqueueJob({
    jobType: "voice_ai_retention",
    queueName: "voice-calls",
    payload: { dayKey },
    idempotencyKey: `voice-retention:global:${dayKey}`,
  });
  await enqueueJob({
    jobType: "voice_webhook_dlq_reprocess",
    queueName: "voice-calls",
    payload: { dayKey, limit: 25 },
    idempotencyKey: `voice-dlq-reprocess:${dayKey}`,
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
