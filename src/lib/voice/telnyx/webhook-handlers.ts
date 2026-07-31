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
  eventPayload: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const { eventType, callId, eventPayload } = input;

  let call = callId
    ? await prisma.voiceCall.findUnique({ where: { id: callId } })
    : null;

  if (!call && eventPayload.call_control_id) {
    call = await prisma.voiceCall.findFirst({
      where: { telnyxCallControlId: String(eventPayload.call_control_id) },
    });
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
