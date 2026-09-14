import "server-only";

import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { JOB_PRIORITY_VOICE_CONSEQUENTIAL } from "@/lib/jobs/job-priority";
import { VOICE_AI_BOOKING_JOB_CREATE } from "@/lib/voice/ai-booking/constants";

export async function enqueueVoiceMctbBookingCreateJob(input: {
  workspaceId: string;
  callId: string;
  conversationId: string;
  slotId: string;
  writeEpoch: number;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  idempotencyKey: string;
}) {
  return enqueueJob({
    workspaceId: input.workspaceId,
    jobType: VOICE_AI_BOOKING_JOB_CREATE,
    queueName: "voice-calls",
    priority: JOB_PRIORITY_VOICE_CONSEQUENTIAL,
    maxAttempts: 8,
    idempotencyKey: input.idempotencyKey,
    payload: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      conversationId: input.conversationId,
      slotId: input.slotId,
      writeEpoch: input.writeEpoch,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      enqueuedAt: new Date().toISOString(),
    },
    wake: true,
  });
}

export async function executeVoiceMctbBookingCreateJob(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const callId = String(payload.callId || "");
  const conversationId = String(payload.conversationId || "");
  const slotId = String(payload.slotId || "");
  const writeEpoch = Number(payload.writeEpoch ?? 0);
  const customerName = String(payload.customerName || "Caller");
  const customerPhone = payload.customerPhone ? String(payload.customerPhone) : null;
  const customerEmail = payload.customerEmail ? String(payload.customerEmail) : null;

  if (!workspaceId || !callId || !conversationId || !slotId) {
    throw new Error("voice_mctb_booking_create_payload_incomplete");
  }

  const { resolveCanonicalBookingTimezone } = await import("@/lib/mctb/ai-booking/booking-timezone");
  const { orchestrateMctbAiBooking } = await import("@/lib/mctb/ai-booking/orchestrator");
  const bookingTimezone = await resolveCanonicalBookingTimezone(workspaceId);

  const result = await orchestrateMctbAiBooking({
    workspaceId,
    conversationId,
    customerName,
    customerPhone,
    customerEmail,
    windowStartUtc: new Date().toISOString(),
    windowEndUtc: new Date(Date.now() + 3600_000).toISOString(),
    timezone: bookingTimezone,
    selectedSlotId: slotId,
    confirmBooking: true,
    writeEpoch,
  });

  if (result.kind !== "booked") {
    throw new Error(`voice_mctb_booking_create_failed:${result.kind}`);
  }

  const { logVoiceAiBookingEvent } = await import("@/lib/voice/ai-booking/observability");
  logVoiceAiBookingEvent("durable_booking_completed", {
    workspaceId,
    callId,
    conversationId,
    slotId,
    providerBookingId: result.booking.providerBookingId,
  });

  return { ok: true, booking: result.booking };
}
