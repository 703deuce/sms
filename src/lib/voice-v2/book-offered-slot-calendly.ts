import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import {
  bookEventInvitee,
  listEventTypeAvailableTimes,
} from "@/lib/integrations/adapters/calendly-actions";
import { loadVoiceV2OfferSet } from "./offer-set-store";
import { evaluateBookingIntakeGate } from "./intake/booking-gate";
import type {
  VoiceV2BookTimingMarks,
  VoiceV2BookTimingMs,
} from "./book-offered-slot";
import type { VoiceV2CallContext } from "./intake/types";

function isoMark(): string {
  return new Date().toISOString();
}
import { resolveVoiceV2CalendlyBookingConfig } from "./calendly-booking-config";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

function intakeSnapshot(ctx: VoiceV2CallContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, field] of Object.entries(ctx.intakeState)) {
    const v = field?.value?.trim();
    if (v) out[key] = v;
  }
  return out;
}

export async function executeVoiceV2BookOfferedSlotCalendly(
  raw: Record<string, unknown>,
  workspaceId: string,
  options: {
    agentId?: string | null;
    offerSetId: string;
    selectedSlotId: string;
    idempotencyKey: string;
    callId: string | null;
    marks: VoiceV2BookTimingMarks;
    timingMs: VoiceV2BookTimingMs;
    t0: number;
  },
): Promise<
  | {
      status: "BOOKING_CONFIRMED";
      slot_id: string;
      offer_set_id: string;
      event_id: string;
      spoken_confirmation: string;
      timing: VoiceV2BookTimingMarks;
      timing_ms: VoiceV2BookTimingMs;
      graph: { GRAPH_REQUEST_COUNT: number; GRAPH_REQUESTS: [] };
    }
  | {
      status: "SLOT_UNAVAILABLE" | "INVALID_OFFER" | "ERROR" | "MISSING_REQUIRED_FIELDS";
      error: string;
      missing_fields?: string[];
      timing: VoiceV2BookTimingMarks;
      timing_ms: VoiceV2BookTimingMs;
    }
> {
  const { offerSetId, selectedSlotId, idempotencyKey, callId, marks, timingMs, t0 } = options;
  const prisma = getPrisma();

  const offerStart = Date.now();
  const offer = await loadVoiceV2OfferSet(workspaceId, offerSetId);
  timingMs.OFFER_RESOLUTION_MS = Date.now() - offerStart;
  marks.OFFER_RESOLVED = isoMark();

  if (!offer) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "INVALID_OFFER",
      error: "offer_set_not_found_or_expired",
      timing: marks,
      timing_ms: timingMs,
    };
  }

  const slot = offer.slots.find((s) => s.slot_id === selectedSlotId);
  if (!slot || slot.provider !== "calendly") {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "INVALID_OFFER",
      error: "selected_slot_not_in_offer_set",
      timing: marks,
      timing_ms: timingMs,
    };
  }

  const startUtc = new Date(slot.start_utc);
  const endUtc = new Date(slot.end_utc);
  if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return { status: "ERROR", error: "slot_time_invalid", timing: marks, timing_ms: timingMs };
  }

  const agentId = String(options.agentId || raw.agent_id || "").trim();
  if (!agentId) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return { status: "ERROR", error: "calendly_booking_requires_agent_id", timing: marks, timing_ms: timingMs };
  }

  const runtime = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  const calCfg = resolveVoiceV2CalendlyBookingConfig(parseVoiceAgentConfig(runtime));
  const eventTypeUri =
    slot.provider_metadata?.event_type_uri || calCfg?.eventTypeUri || "";
  if (!eventTypeUri) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return { status: "ERROR", error: "calendly_event_type_not_configured", timing: marks, timing_ms: timingMs };
  }

  const gate = await evaluateBookingIntakeGate({
    workspaceId,
    agentId,
    callControlId: callId,
    conversationId: String(raw.conversation_id || raw.telnyx_conversation_id || ""),
    fromE164: String(raw.from || raw.caller || ""),
    bookingStrategy: "CALENDLY",
  });
  if (!gate.allowed) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "MISSING_REQUIRED_FIELDS",
      error: "missing_required_intake_fields",
      missing_fields: gate.missing_fields,
      timing: marks,
      timing_ms: timingMs,
    };
  }

  marks.SLOT_REVALIDATION_START = isoMark();
  const revalStart = Date.now();
  const adapterCtx = await buildAdapterContext(workspaceId, "calendly");
  const revalWindowStart = new Date(startUtc.getTime() - 60_000).toISOString();
  const revalWindowEnd = new Date(endUtc.getTime() + 60_000).toISOString();
  const avail = await listEventTypeAvailableTimes(adapterCtx, {
    eventTypeUri,
    startTime: revalWindowStart,
    endTime: revalWindowEnd,
  });
  const stillOpen = avail.slots.some(
    (s) => new Date(s.startTime).getTime() === startUtc.getTime() && /available/i.test(s.status || "available"),
  );
  timingMs.REVALIDATION_MS = Date.now() - revalStart;
  marks.SLOT_REVALIDATION_END = isoMark();
  if (!stillOpen) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "SLOT_UNAVAILABLE",
      error: "slot_no_longer_available",
      timing: marks,
      timing_ms: timingMs,
    };
  }

  const { resolveSessionKey } = await import("./intake/load-call-context");
  const { getVoiceV2CallContext } = await import("./intake/session-store");
  const { formatIntakeEventNotes } = await import("./intake/format-event-notes");
  const sk = resolveSessionKey({ callControlId: callId, conversationId: null });
  const ctx = sk ? getVoiceV2CallContext(sk) : null;
  const fields = ctx ? intakeSnapshot(ctx) : {};
  const name = fields.name || fields.full_name || "Caller";
  const email = fields.email || "";
  const phone = fields.phone || String(raw.from || raw.caller || "");

  const spokenLabel = slot.spoken_label || slot.label;
  const spokenConfirmation = `You're booked for ${spokenLabel}.`;

  marks.GRAPH_CREATE_START = isoMark();
  const graphCreateStart = Date.now();
  let booked: Awaited<ReturnType<typeof bookEventInvitee>>;
  try {
    booked = await bookEventInvitee(adapterCtx, {
      eventTypeUri,
      startTime: slot.start_utc,
      name,
      email,
      timezone: offer.timezone,
      phone: phone || null,
    });
  } catch (err) {
    timingMs.GRAPH_CREATE_MS = Date.now() - graphCreateStart;
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    const msg = err instanceof Error ? err.message : String(err);
    if (/slot|unavailable|conflict/i.test(msg)) {
      return { status: "SLOT_UNAVAILABLE", error: "slot_no_longer_available", timing: marks, timing_ms: timingMs };
    }
    return {
      status: "ERROR",
      error: msg.includes("plan") ? "calendly_plan_required" : "calendly_booking_failed",
      timing: marks,
      timing_ms: timingMs,
    };
  }
  marks.GRAPH_CREATE_END = isoMark();
  timingMs.GRAPH_CREATE_MS = Date.now() - graphCreateStart;

  const eventId = booked.eventUri;
  const appointmentId = createId();
  let intakeNotes = "";
  if (ctx) {
    intakeNotes = formatIntakeEventNotes(ctx.intakeSchema, ctx.intakeState);
  }

  let resolvedCallId: string | null = null;
  if (callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { OR: [{ id: callId }, { telnyxCallControlId: callId }], workspaceId },
      select: { id: true },
    });
    resolvedCallId = call?.id ?? null;
  }

  await prisma.voiceAppointment.create({
    data: {
      id: appointmentId,
      workspaceId,
      callId: resolvedCallId,
      serviceName: offer.serviceName,
      startsAt: startUtc,
      endsAt: endUtc,
      timezone: offer.timezone,
      status: "confirmed",
      externalId: eventId,
      metadata: {
        voice_v2: true,
        provider: "calendly",
        invitee_uri: booked.inviteeUri,
        event_type_uri: eventTypeUri,
        offer_set_id: offerSetId,
        slot_id: selectedSlotId,
        idempotency_key: idempotencyKey,
        intake_notes: intakeNotes || undefined,
      },
    },
  });

  const resultPayload = {
    slot_id: selectedSlotId,
    offer_set_id: offerSetId,
    event_id: eventId,
    provider: "calendly",
    spoken_confirmation: spokenConfirmation,
    spoken_label: spokenLabel,
    start_utc: slot.start_utc,
    end_utc: slot.end_utc,
  };

  try {
    await prisma.voiceV2BookingIdempotency.create({
      data: {
        idempotencyKey,
        workspaceId,
        offerSetId,
        slotId: selectedSlotId,
        microsoftEventId: eventId,
        voiceAppointmentId: appointmentId,
        resultJson: resultPayload as object,
      },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      const again = await prisma.voiceV2BookingIdempotency.findUnique({
        where: { idempotencyKey },
      });
      if (again?.microsoftEventId) {
        timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
        marks.RESPONSE_SENT = isoMark();
        return {
          status: "BOOKING_CONFIRMED",
          slot_id: selectedSlotId,
          offer_set_id: offerSetId,
          event_id: again.microsoftEventId,
          spoken_confirmation: spokenConfirmation,
          timing: marks,
          timing_ms: timingMs,
          graph: { GRAPH_REQUEST_COUNT: 0, GRAPH_REQUESTS: [] },
        };
      }
    }
    throw err;
  }

  timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
  marks.RESPONSE_SENT = isoMark();
  return {
    status: "BOOKING_CONFIRMED",
    slot_id: selectedSlotId,
    offer_set_id: offerSetId,
    event_id: eventId,
    spoken_confirmation: spokenConfirmation,
    timing: marks,
    timing_ms: timingMs,
    graph: { GRAPH_REQUEST_COUNT: 0, GRAPH_REQUESTS: [] },
  };
}
