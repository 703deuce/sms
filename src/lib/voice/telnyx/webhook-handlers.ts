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
      const { evaluateInboundRouting } = await import("../routing");
      const routing = await evaluateInboundRouting({
        workspaceId: pn.workspaceId,
        fromE164: from,
        toE164: to,
        isKnownContact: false,
      });

      if (routing.action !== "ai_answer") {
        const { handleInboundHumanCall } = await import("@/lib/phone/human-call-service");
        await handleInboundHumanCall({
          workspaceId: pn.workspaceId,
          fromE164: from,
          toE164: to,
          telnyxCallControlId: String(eventPayload.call_control_id || ""),
        });
        await prisma.providerWebhookEvent.update({
          where: { providerEventId: input.providerEventId },
          data: { status: "processed", processedAt: new Date() },
        });
        return { ok: true, kind: "human_inbound" };
      }

      const { handleInboundCallEvent } = await import("../inbound");
      const result = await handleInboundCallEvent({
        workspaceId: pn.workspaceId,
        fromE164: from,
        toE164: to,
        telnyxCallControlId: String(eventPayload.call_control_id || ""),
        payload: eventPayload,
      });
      call = await prisma.voiceCall.findUnique({ where: { id: result.callId } });
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

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId,
      callId: call.id,
      eventType,
      providerEventId: input.providerEventId,
      payload: eventPayload as object,
    },
  });

  const statusMap: Record<string, string> = {
    "call.initiated": "INITIATED",
    "call.ringing": "RINGING",
    "call.answered": "ANSWERED",
    "call.bridged": "IN_PROGRESS",
    "call.hangup": "COMPLETED",
    "call.machine.detection.ended": "VOICEMAIL",
    "call.machine.premium.detection.ended": "VOICEMAIL",
    "call.recording.saved": "COMPLETED",
    "call.transcription.completed": "COMPLETED",
  };

  const nextStatus = statusMap[eventType];
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (nextStatus) {
    patch.status = nextStatus;
    if (nextStatus === "ANSWERED" || nextStatus === "IN_PROGRESS") {
      patch.answeredAt = new Date();
    }
    if (nextStatus === "COMPLETED" || nextStatus === "VOICEMAIL") {
      patch.endedAt = new Date();
    }
  }

  if (eventType.includes("machine") && eventType.includes("detection")) {
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

  if (eventPayload.call_control_id) {
    patch.telnyxCallControlId = String(eventPayload.call_control_id);
  }

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: patch,
  });

  if (eventType === "call.hangup" || eventType === "call.machine.detection.ended") {
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
