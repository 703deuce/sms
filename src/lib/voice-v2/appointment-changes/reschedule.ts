import "server-only";

import { getPrisma } from "@/lib/db";
import {
  getValidAccessToken,
  hasOAuthTokens,
  getMicrosoftBusy,
  updateMicrosoftEvent,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import { loadVoiceV2OfferSet } from "../offer-set-store";
import { resolveSessionKey } from "../intake/load-call-context";
import { resolveStoredAppointmentRef, selectAppointmentRef } from "./ref-store";
import type { RescheduleAppointmentResult } from "./types";

function slotOverlapsBusy(
  start: Date,
  end: Date,
  busy: Array<{ start: Date; end: Date }>,
): boolean {
  for (const b of busy) {
    if (start < b.end && end > b.start) return true;
  }
  return false;
}

export async function executeVoiceV2RescheduleAppointment(
  raw: Record<string, unknown>,
  workspaceId: string,
  options?: { agentId?: string | null },
): Promise<RescheduleAppointmentResult> {
  const offerSetId = String(raw.offer_set_id || raw.offerSetId || "").trim();
  const selectedSlotId = String(raw.selected_slot_id || raw.selectedSlotId || "").trim();
  const appointmentRefId = String(raw.appointment_ref_id || raw.appointmentRefId || "").trim();
  const toolInvocationId = String(raw.tool_invocation_id || raw.toolInvocationId || "").trim();
  const callId = String(raw.call_id || raw.callId || "").trim();

  if (!offerSetId || !selectedSlotId || !appointmentRefId) {
    return { status: "INVALID_OFFER", error: "offer_slot_and_appointment_ref_required" };
  }

  const agentId = options?.agentId?.trim() || String(raw.agent_id || "").trim();
  if (agentId) {
    const { voiceV2AppointmentChangeCapabilities } = await import("./capabilities");
    const caps = await voiceV2AppointmentChangeCapabilities({ workspaceId, agentId });
    if (!caps.reschedule) return { status: "ERROR", error: "reschedule_not_enabled" };
  }

  const sessionKey = callId
    ? resolveSessionKey({ callControlId: callId, conversationId: null })
    : null;
  if (!sessionKey) return { status: "INVALID_REF", error: "session_required" };

  selectAppointmentRef(sessionKey, appointmentRefId);
  const ref = resolveStoredAppointmentRef(sessionKey, appointmentRefId);
  if (!ref) return { status: "INVALID_REF", error: "appointment_ref_not_found" };
  if (ref.provider !== "microsoft") {
    return { status: "ERROR", error: "provider_not_supported_yet" };
  }
  if (ref.eventKind === "seriesMaster") {
    return { status: "ERROR", error: "cannot_reschedule_series_master" };
  }

  const idempotencyKey = toolInvocationId
    ? `v2reschedule:${workspaceId}:${toolInvocationId}`
    : `v2reschedule:${workspaceId}:${appointmentRefId}:${selectedSlotId}`;

  const prisma = getPrisma();
  const existing = await prisma.voiceV2BookingIdempotency.findUnique({
    where: { idempotencyKey },
  });
  if (existing?.microsoftEventId && existing.resultJson) {
    const cached = existing.resultJson as Record<string, unknown>;
    return {
      status: "RESCHEDULE_CONFIRMED",
      appointment_ref_id: appointmentRefId,
      event_id: existing.microsoftEventId,
      spoken_confirmation: String(
        cached.spoken_confirmation || "Your appointment has been moved.",
      ),
    };
  }

  const offer = await loadVoiceV2OfferSet(workspaceId, offerSetId);
  if (!offer) return { status: "INVALID_OFFER", error: "offer_set_not_found_or_expired" };

  const slot = offer.slots.find((s) => s.slot_id === selectedSlotId);
  if (!slot) return { status: "INVALID_OFFER", error: "selected_slot_not_in_offer_set" };

  const startUtc = new Date(slot.start_utc);
  const endUtc = new Date(slot.end_utc);
  if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    return { status: "ERROR", error: "slot_time_invalid" };
  }

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: ref.connectionId, workspaceId, provider: "microsoft" },
  });
  if (!conn || conn.status !== "connected") {
    return { status: "ERROR", error: "microsoft_connection_not_connected" };
  }
  const config = (conn.config || {}) as CalendarConfig;
  if (!hasOAuthTokens(config)) return { status: "ERROR", error: "microsoft_oauth_tokens_missing" };

  const token = await getValidAccessToken(conn.id, "microsoft", config);
  if (!token) return { status: "ERROR", error: "microsoft_token_unavailable" };

  const busy = await getMicrosoftBusy(token, startUtc, endUtc, {
    ctx: { connectionId: conn.id, config },
    smtp: config.email,
  });
  const foreignBusy = busy.filter((b) => {
    const refStart = new Date(ref.startsAtUtc).getTime();
    const refEnd = new Date(ref.endsAtUtc).getTime();
    const overlapsRef = b.start.getTime() < refEnd && b.end.getTime() > refStart;
    return !overlapsRef;
  });
  if (slotOverlapsBusy(startUtc, endUtc, foreignBusy)) {
    return { status: "SLOT_UNAVAILABLE", error: "slot_no_longer_available" };
  }

  try {
    await updateMicrosoftEvent(
      token,
      ref.providerEventId,
      { start: startUtc, end: endUtc, timezone: offer.timezone },
      { connectionId: conn.id, config },
    );
  } catch (err) {
    return {
      status: "ERROR",
      error: err instanceof Error ? err.message : "microsoft_update_failed",
    };
  }

  const spokenLabel = slot.spoken_label || slot.label;
  const spokenConfirmation = `You're all set. I moved your appointment to ${spokenLabel}.`;

  if (ref.voiceAppointmentId) {
    void prisma.voiceAppointment
      .update({
        where: { id: ref.voiceAppointmentId },
        data: {
          startsAt: startUtc,
          endsAt: endUtc,
          timezone: offer.timezone,
          metadata: {
            rescheduled_at: new Date().toISOString(),
            previous_start: ref.startsAtUtc,
            previous_end: ref.endsAtUtc,
          },
        },
      })
      .catch(() => undefined);
  }

  try {
    await prisma.voiceV2BookingIdempotency.create({
      data: {
        idempotencyKey,
        workspaceId,
        offerSetId,
        slotId: selectedSlotId,
        microsoftEventId: ref.providerEventId,
        voiceAppointmentId: ref.voiceAppointmentId ?? null,
        resultJson: {
          spoken_confirmation: spokenConfirmation,
          appointment_ref_id: appointmentRefId,
          strategy: "NATIVE_UPDATE",
        } as object,
      },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "P2002") throw err;
  }

  return {
    status: "RESCHEDULE_CONFIRMED",
    appointment_ref_id: appointmentRefId,
    event_id: ref.providerEventId,
    spoken_confirmation: spokenConfirmation,
  };
}
