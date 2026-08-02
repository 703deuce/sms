import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

type TelnyxPayload = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: Record<string, unknown>;
    record_type?: string;
  };
};

function decodeClientState(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

export async function handleTelnyxVoiceWebhook(request: Request) {
  const verified = await readTelnyxWebhook(request);
  if (!verified.ok) return verified.response;

  const payload = verified.payload;
  const body = payload as TelnyxPayload;
  const eventType = body.data?.event_type || "unknown";
  const providerEventId = body.data?.id || `${eventType}:${Date.now()}`;
  const eventPayload = (body.data?.payload || {}) as Record<string, unknown>;

  const prisma = getPrisma();

  // Idempotency
  const existing = await prisma.providerWebhookEvent.findUnique({
    where: { providerEventId },
  });
  if (existing?.status === "processed") {
    return { ok: true, duplicate: true };
  }

  const clientState = decodeClientState(
    eventPayload.client_state as string | undefined,
  );
  const workspaceId = clientState.workspaceId as string | undefined;
  const callId = clientState.callId as string | undefined;
  const humanCallId = clientState.humanCallId as string | undefined;
  const isHuman = clientState.kind === "human" || Boolean(humanCallId);

  await prisma.providerWebhookEvent.upsert({
    where: { providerEventId },
    create: {
      workspaceId,
      provider: "telnyx",
      eventType,
      providerEventId,
      payload: body as object,
      status: "received",
    },
    update: {
      payload: body as object,
    },
  });

  // Fast ACK — heavy work in background job
  await enqueueJob({
    jobType: "voice_webhook_process",
    queueName: "voice-calls",
    payload: {
      providerEventId,
      eventType,
      workspaceId,
      callId,
      humanCallId,
      isHuman,
      eventPayload,
    } as Prisma.InputJsonValue,
    idempotencyKey: `voice-webhook:${providerEventId}`,
  });

  return { ok: true, eventType, providerEventId };
}

export async function processVoiceWebhookEvent(input: {
  providerEventId: string;
  eventType: string;
  workspaceId?: string;
  callId?: string;
  humanCallId?: string;
  isHuman?: boolean;
  eventPayload: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const { eventType, callId, humanCallId, isHuman, eventPayload } = input;

  // Softphone call screening gather (accept / voicemail).
  if (eventType === "call.gather.ended" || eventType === "call.dtmf.received") {
    const screeningState = (() => {
      const raw = eventPayload.client_state;
      if (typeof raw !== "string") return {};
      try {
        return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();
    if (screeningState.kind === "call_screening") {
      // Screening gather / answer can arrive as gather.ended on the agent leg,
      // or as call.answered when the agent phone picks up (handled below via human webhook).
      const digit = String(eventPayload.digits || eventPayload.digit || "").trim();
      const agentControlId = String(eventPayload.call_control_id || "");
      const humanCallId = String(screeningState.humanCallId || "");
      const parentId = String(screeningState.parentCallControlId || "");
      const workspaceId = String(screeningState.workspaceId || input.workspaceId || "");

      if (eventType === "call.gather.ended" || eventType === "call.dtmf.received") {
        if ((digit === "2" || !digit) && humanCallId && parentId) {
          const { leaveVoicemailOnCall } = await import("@/lib/phone/voicemail-service");
          await leaveVoicemailOnCall({
            workspaceId,
            humanCallId,
            telnyxCallControlId: parentId,
            userId: screeningState.userId ? String(screeningState.userId) : null,
          }).catch(() => undefined);
          if (agentControlId) {
            const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
            await telnyxRequest(`/calls/${agentControlId}/actions/hangup`, {
              method: "POST",
              body: {},
            }).catch(() => undefined);
          }
        } else if (digit === "1" && humanCallId && parentId && agentControlId) {
          const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
          await telnyxRequest(`/calls/${parentId}/actions/unhold`, {
            method: "POST",
            body: {},
          }).catch(() => undefined);
          await telnyxRequest(`/calls/${parentId}/actions/bridge`, {
            method: "POST",
            body: { call_control_id: agentControlId },
          }).catch(() => undefined);
          await prisma.humanCall.update({
            where: { id: humanCallId },
            data: {
              status: "in_progress",
              onHold: false,
              answeredAt: new Date(),
              notes: "screening:accepted",
            },
          }).catch(() => undefined);
        }
        await prisma.providerWebhookEvent.update({
          where: { providerEventId: input.providerEventId },
          data: { status: "processed", processedAt: new Date() },
        });
        return { ok: true, kind: "call_screening", digit };
      }
    }
  }

  // IVR keypad selection — route the caller to their chosen option.
  if (eventType === "call.gather.ended" || eventType === "call.dtmf.received") {
    const { handleIvrGatherEnded } = await import("@/lib/phone/ivr-service");
    const ivrResult = await handleIvrGatherEnded(eventPayload).catch(() => ({
      handled: false as const,
    }));
    if (ivrResult.handled) {
      await prisma.providerWebhookEvent.update({
        where: { providerEventId: input.providerEventId },
        data: { status: "processed", processedAt: new Date() },
      });
      return { ok: true, kind: "ivr", ...ivrResult };
    }
  }

  // Human agent softphone calls
  if (isHuman || humanCallId) {
    const { processHumanCallWebhookEvent } = await import("@/lib/phone/human-call-service");
    const humanResult = await processHumanCallWebhookEvent({
      eventType,
      humanCallId,
      eventPayload,
    });
    if (humanResult.ok) {
      await prisma.providerWebhookEvent.update({
        where: { providerEventId: input.providerEventId },
        data: { status: "processed", processedAt: new Date() },
      });
      return humanResult;
    }
  }

  let humanCall = humanCallId
    ? await prisma.humanCall.findUnique({ where: { id: humanCallId } })
    : null;
  if (!humanCall && eventPayload.call_control_id) {
    humanCall = await prisma.humanCall.findFirst({
      where: { telnyxCallControlId: String(eventPayload.call_control_id) },
    });
  }
  if (humanCall) {
    const { processHumanCallWebhookEvent } = await import("@/lib/phone/human-call-service");
    const humanResult = await processHumanCallWebhookEvent({
      eventType,
      humanCallId: humanCall.id,
      eventPayload,
    });
    await prisma.providerWebhookEvent.update({
      where: { providerEventId: input.providerEventId },
      data: { status: "processed", processedAt: new Date() },
    });
    return humanResult;
  }

  let call = callId
    ? await prisma.voiceCall.findUnique({ where: { id: callId } })
    : null;

  if (!call && eventPayload.call_control_id) {
    call = await prisma.voiceCall.findFirst({
      where: { telnyxCallControlId: String(eventPayload.call_control_id) },
    });
  }

  // New inbound leg — create call + routing
  if (!call && eventType === "call.initiated") {
    const to = String(eventPayload.to || "");
    const from = String(eventPayload.from || "");
    const pn = await prisma.phoneNumber.findFirst({ where: { e164: to } });
    if (pn) {
      // If an IVR menu is active for this number, greet + gather a DTMF digit
      // and defer routing until call.gather.ended.
      const { resolveIvrForNumber, startIvrGather } = await import("@/lib/phone/ivr-service");
      const ivr = await resolveIvrForNumber(pn.workspaceId, to);
      if (ivr && eventPayload.call_control_id) {
        await startIvrGather(String(eventPayload.call_control_id), ivr).catch(() => undefined);
        await prisma.providerWebhookEvent.update({
          where: { providerEventId: input.providerEventId },
          data: { status: "processed", processedAt: new Date() },
        });
        return { ok: true, kind: "ivr_gather" };
      }

      // Phone-first per number: softphone when this DID has a human assignment,
      // queue/IVR path, or the assigned user's softphone device.
      // Do NOT force softphone for every number just because some workspace device exists.
      const humanAssignment = await prisma.phoneNumberAssignment.findFirst({
        where: { phoneNumberId: pn.id },
      });
      let hasQueueOrIvr = false;
      try {
        const { resolveQueueForInbound } = await import("@/lib/phone/queue-service");
        const { resolveIvrForNumber } = await import("@/lib/phone/ivr-service");
        const [q, ivr] = await Promise.all([
          resolveQueueForInbound(pn.workspaceId, to),
          resolveIvrForNumber(pn.workspaceId, to),
        ]);
        hasQueueOrIvr = Boolean(q || ivr);
      } catch {
        // ignore resolution failures
      }
      const assignedDeviceCount = humanAssignment
        ? await prisma.softphoneDevice.count({
            where: {
              workspaceId: pn.workspaceId,
              active: true,
              userId: humanAssignment.userId,
            },
          })
        : 0;
      const preferSoftphone =
        Boolean(humanAssignment) || hasQueueOrIvr || assignedDeviceCount > 0;

      let aiAgent = null;
      if (!preferSoftphone) {
        const { resolveInboundAiAgent } = await import("../agent-phone");
        aiAgent = await resolveInboundAiAgent(pn.workspaceId, pn.id);
      }

      if (aiAgent) {
        const { handleInboundCallEvent } = await import("../inbound");
        const result = await handleInboundCallEvent({
          workspaceId: pn.workspaceId,
          fromE164: from,
          toE164: to,
          telnyxCallControlId: String(eventPayload.call_control_id || ""),
          payload: eventPayload,
        });
        call = await prisma.voiceCall.findUnique({ where: { id: result.callId } });
      } else {
        const { processSoftphoneInbound } = await import("@/lib/phone/inbound-runtime");
        await processSoftphoneInbound({
          workspaceId: pn.workspaceId,
          fromE164: from,
          toE164: to,
          telnyxCallControlId: String(eventPayload.call_control_id || ""),
        });
        await prisma.providerWebhookEvent.update({
          where: { providerEventId: input.providerEventId },
          data: { status: "processed", processedAt: new Date() },
        });
        return { ok: true, kind: "softphone_inbound" };
      }
    }
  }

  if (!call) {
    await prisma.providerWebhookEvent.update({
      where: { providerEventId: input.providerEventId },
      data: { status: "ignored", processedAt: new Date() },
    });
    return { ok: false, reason: "call_not_found" };
  }

  const workspaceId = call.workspaceId;

  // Warm transfer consult leg answered — speak summary to agent; keep caller on hold
  // until completeWarmTransfer is invoked (true warm consult UX).
  const clientStateRaw = eventPayload.client_state;
  let warmState: Record<string, unknown> = {};
  if (typeof clientStateRaw === "string") {
    try {
      warmState = JSON.parse(Buffer.from(clientStateRaw, "base64").toString("utf8"));
    } catch {
      warmState = {};
    }
  }
  if (
    warmState.kind === "warm_transfer_consult" &&
    eventType === "call.answered" &&
    warmState.transferId &&
    warmState.callerControlId
  ) {
    const { handleWarmTransferConsultAnswered } = await import("../transfers");
    await handleWarmTransferConsultAnswered({
      workspaceId,
      callId: String(warmState.callId || call.id),
      transferId: String(warmState.transferId),
      consultControlId: String(eventPayload.call_control_id || ""),
      callerControlId: String(warmState.callerControlId),
      summary: warmState.summary ? String(warmState.summary) : undefined,
    }).catch((err) => console.warn("[voice/webhook] warm transfer consult failed", err));
  }

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId,
      callId: call.id,
      eventType,
      providerEventId: input.providerEventId,
      payload: eventPayload as object,
    },
  });

  // Secondary legs (warm consult, etc.) must not overwrite the parent VoiceCall
  // control id or mark the live AI/customer call completed on consult hangup.
  const isSecondaryVoiceLeg = warmState.kind === "warm_transfer_consult";

  const statusMap: Record<string, string> = {
    "call.initiated": "INITIATED",
    "call.ringing": "RINGING",
    "call.answered": "ANSWERED",
    "call.bridged": "IN_PROGRESS",
    "call.hangup": "COMPLETED",
    "call.machine.detection.ended": "VOICEMAIL",
    "call.machine.premium.detection.ended": "VOICEMAIL",
    // recording.saved / transcription.completed must NOT end a live AI call.
  };

  let nextStatus = isSecondaryVoiceLeg ? undefined : statusMap[eventType];
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  // On hangup, refine COMPLETED into a missed-call status when the call was
  // never answered, based on the provider hangup cause.
  if (
    !isSecondaryVoiceLeg &&
    eventType === "call.hangup" &&
    !call.answeredAt &&
    !call.voicemailDetected
  ) {
    const cause = String(
      eventPayload.hangup_cause || eventPayload.sip_hangup_cause || "",
    ).toLowerCase();
    if (cause.includes("busy")) {
      nextStatus = "BUSY";
      patch.outcome = "busy";
    } else if (cause.includes("cancel") || cause.includes("rejected")) {
      nextStatus = "CANCELLED";
      patch.outcome = "cancelled";
    } else if (
      cause.includes("no_answer") ||
      cause.includes("no-answer") ||
      cause.includes("noanswer") ||
      cause.includes("timeout") ||
      cause.includes("no_user_response") ||
      cause === ""
    ) {
      nextStatus = "NO_ANSWER";
      patch.outcome = "no_answer";
    }
  }

  if (nextStatus) {
    patch.status = nextStatus;
    if (nextStatus === "ANSWERED" || nextStatus === "IN_PROGRESS") {
      patch.answeredAt = new Date();
    }
    if (
      nextStatus === "COMPLETED" ||
      nextStatus === "VOICEMAIL" ||
      nextStatus === "NO_ANSWER" ||
      nextStatus === "BUSY" ||
      nextStatus === "CANCELLED"
    ) {
      patch.endedAt = new Date();
    }
  }

  if (!isSecondaryVoiceLeg && eventType.includes("machine") && eventType.includes("detection")) {
    patch.voicemailDetected = true;
    patch.outcome = "voicemail";
    if (call.campaignId) {
      const { applyVoicemailPolicy } = await import("../campaigns");
      await applyVoicemailPolicy(workspaceId, call.id, call.campaignId);
    }
    const amd = String(eventPayload.result || eventPayload.machine_detection_result || "");
    if (amd) {
      const { handleTransferAmdResult } = await import("../transfers");
      await handleTransferAmdResult(call.id, workspaceId, amd);
    }
  }

  // Never replace the customer/AI control id with a consult/secondary leg id.
  if (eventPayload.call_control_id && !isSecondaryVoiceLeg) {
    patch.telnyxCallControlId = String(eventPayload.call_control_id);
  }

  if (Object.keys(patch).length > 1 || nextStatus) {
    await prisma.voiceCall.update({
      where: { id: call.id },
      data: patch,
    });
  }

  // Outbound (and any unanswered AI leg): when the callee answers, start the assistant.
  if (
    !isSecondaryVoiceLeg &&
    (eventType === "call.answered" || eventType === "call.bridged") &&
    call.agentId &&
    !call.voicemailDetected
  ) {
    const meta = (call.metadata || {}) as Record<string, unknown>;
    if (!meta.aiStarted) {
      const agent = await prisma.voiceAgent.findUnique({ where: { id: call.agentId } });
      const controlId = String(eventPayload.call_control_id || call.telnyxCallControlId || "");
      if (agent?.telnyxAssistantId && controlId) {
        const {
          startAiAssistantOnCall,
          startCallRecording,
          startCallTranscription,
        } = await import("../telnyx/assistant-sync");
        const { resolveCallDynamicVariables } = await import("../dynamic-variables");
        const storedVars = (call.dynamicVariables || {}) as Record<string, unknown>;
        const dynamicVariables = await resolveCallDynamicVariables({
          workspaceId,
          agentId: agent.id,
          callId: call.id,
          contactId: call.contactId,
          fromE164: call.fromE164,
          toE164: call.toE164,
          direction: call.direction,
          overrides: storedVars,
        });
        await startAiAssistantOnCall({
          callControlId: controlId,
          assistantId: agent.telnyxAssistantId,
          dynamicVariables,
          clientState: {
            workspaceId,
            callId: call.id,
            agentId: agent.id,
          },
        }).catch((err) => console.error("[voice/webhook] ai_assistant_start", err));
        await startCallRecording(controlId);
        await startCallTranscription(controlId);
        await prisma.voiceCall.update({
          where: { id: call.id },
          data: {
            dynamicVariables: dynamicVariables as object,
            metadata: {
              ...meta,
              aiStarted: true,
              assistantId: agent.telnyxAssistantId,
              transcriptionStarted: true,
            } as object,
          },
        });
      }
    }
  }

  if (
    !isSecondaryVoiceLeg &&
    (eventType === "call.hangup" || eventType === "call.machine.detection.ended")
  ) {
    await enqueueJob({
      jobType: "voice_post_call",
      queueName: "voice-calls",
      payload: { callId: call.id, workspaceId },
      idempotencyKey: `voice-post-call:${call.id}`,
    });
  }

  if (eventType === "call.recording.saved") {
    await enqueueJob({
      jobType: "voice_recording_ingest",
      queueName: "voice-calls",
      payload: {
        callId: call.id,
        workspaceId,
        recordingUrl: eventPayload.recording_urls,
        providerRecordingId: eventPayload.recording_id,
      } as Prisma.InputJsonValue,
      idempotencyKey: `voice-recording:${call.id}:${eventPayload.recording_id || "0"}`,
    });
  }

  await prisma.providerWebhookEvent.update({
    where: { providerEventId: input.providerEventId },
    data: { status: "processed", processedAt: new Date() },
  });

  return { ok: true, callId: call.id };
}
