import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { resolveMctbMicrosoftConnectionId } from "@/lib/mctb/ai-booking/microsoft-connection";
import {
  getMicrosoftBusy,
  getValidAccessToken,
  hasOAuthTokens,
  insertMicrosoftEvent,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import { loadVoiceV2OfferSet } from "./offer-set-store";
import {
  beginVoiceV2GraphCollection,
  endVoiceV2GraphCollection,
  type VoiceV2GraphSpan,
} from "./graph-instrumentation";

export type VoiceV2BookTimingMarks = {
  WEBHOOK_RECEIVED?: string;
  OFFER_RESOLVED?: string;
  SLOT_REVALIDATION_START?: string;
  SLOT_REVALIDATION_END?: string;
  TOKEN_START?: string;
  TOKEN_END?: string;
  GRAPH_CREATE_START?: string;
  GRAPH_CREATE_END?: string;
  RESPONSE_SENT?: string;
};

export type VoiceV2BookTimingMs = {
  OFFER_RESOLUTION_MS: number;
  REVALIDATION_MS: number;
  TOKEN_MS: number;
  GRAPH_CREATE_MS: number;
  TOTAL_BACKEND_MS: number;
};

function isoMark(): string {
  return new Date().toISOString();
}

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

export async function executeVoiceV2BookOfferedSlot(
  raw: Record<string, unknown>,
  workspaceId: string,
  options?: { agentId?: string | null },
): Promise<
  | {
      status: "BOOKING_CONFIRMED";
      slot_id: string;
      offer_set_id: string;
      event_id: string;
      spoken_confirmation: string;
      timing: VoiceV2BookTimingMarks;
      timing_ms: VoiceV2BookTimingMs;
      graph: { GRAPH_REQUEST_COUNT: number; GRAPH_REQUESTS: VoiceV2GraphSpan[] };
    }
  | {
      status: "SLOT_UNAVAILABLE" | "INVALID_OFFER" | "ERROR" | "MISSING_REQUIRED_FIELDS";
      error: string;
      missing_fields?: string[];
      timing: VoiceV2BookTimingMarks;
      timing_ms: VoiceV2BookTimingMs;
    }
> {
  const t0 = Date.now();
  const marks: VoiceV2BookTimingMarks = { WEBHOOK_RECEIVED: isoMark() };
  const timingMs: VoiceV2BookTimingMs = {
    OFFER_RESOLUTION_MS: 0,
    REVALIDATION_MS: 0,
    TOKEN_MS: 0,
    GRAPH_CREATE_MS: 0,
    TOTAL_BACKEND_MS: 0,
  };
  const graphSpans: VoiceV2GraphSpan[] = [];

  const offerSetId = String(raw.offer_set_id || raw.offerSetId || "").trim();
  const selectedSlotId = String(raw.selected_slot_id || raw.selectedSlotId || "").trim();
  const toolInvocationId = String(
    raw.tool_invocation_id || raw.toolInvocationId || raw.invocation_id || "",
  ).trim();
  const callId = raw.call_id || raw.callId ? String(raw.call_id || raw.callId) : null;
  const agentId = String(options?.agentId || raw.agent_id || raw.agentId || "").trim();
  if (agentId) {
    const { resolveSessionKey } = await import("./intake/load-call-context");
    const { getVoiceV2CallContext } = await import("./intake/session-store");
    const sessionKey = resolveSessionKey({
      callControlId: callId,
      conversationId: String(raw.conversation_id || raw.conversationId || ""),
    });
    const ctx = sessionKey ? getVoiceV2CallContext(sessionKey) : null;
    const gate = await (
      await import("./authorize-find-book")
    ).assertVoiceV2FindBookAllowed({
      workspaceId,
      agentId,
      ctx,
    });
    if (!gate.allowed) {
      timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
      marks.RESPONSE_SENT = isoMark();
      return {
        status: "ERROR",
        error: gate.status,
        timing: marks,
        timing_ms: timingMs,
      };
    }
    const qualGate = await (
      await import("./qualification-gate")
    ).evaluateQualificationPrimaryActionGate({
      workspaceId,
      agentId,
      ctx,
    });
    if (!qualGate.allowed) {
      timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
      marks.RESPONSE_SENT = isoMark();
      return {
        status: "ERROR",
        error: qualGate.status,
        timing: marks,
        timing_ms: timingMs,
      };
    }
  }

  if (!offerSetId || !selectedSlotId) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "INVALID_OFFER",
      error: "offer_set_id_and_selected_slot_id_required",
      timing: marks,
      timing_ms: timingMs,
    };
  }

  const idempotencyKey = toolInvocationId
    ? `v2book:${workspaceId}:${toolInvocationId}`
    : `v2book:${workspaceId}:${offerSetId}:${selectedSlotId}`;

  const prisma = getPrisma();
  const existing = await prisma.voiceV2BookingIdempotency.findUnique({
    where: { idempotencyKey },
  });
  if (existing?.resultJson && existing.microsoftEventId) {
    const cached = existing.resultJson as Record<string, unknown>;
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "BOOKING_CONFIRMED",
      slot_id: String(cached.slot_id || selectedSlotId),
      offer_set_id: offerSetId,
      event_id: existing.microsoftEventId,
      spoken_confirmation: String(
        cached.spoken_confirmation || "Your appointment is already confirmed.",
      ),
      timing: marks,
      timing_ms: timingMs,
      graph: { GRAPH_REQUEST_COUNT: 0, GRAPH_REQUESTS: [] },
    };
  }

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

  if (offer.voiceCallId && callId) {
    const call = await prisma.voiceCall.findFirst({
      where: {
        OR: [{ id: callId }, { telnyxCallControlId: callId }],
      },
      select: { id: true, telnyxCallControlId: true },
    });
    const resolved = call?.id || call?.telnyxCallControlId;
    if (resolved && offer.voiceCallId !== resolved && offer.voiceCallId !== callId) {
      timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
      marks.RESPONSE_SENT = isoMark();
      return {
        status: "INVALID_OFFER",
        error: "offer_set_call_mismatch",
        timing: marks,
        timing_ms: timingMs,
      };
    }
  }

  const slot = offer.slots.find((s) => s.slot_id === selectedSlotId);
  if (!slot) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "INVALID_OFFER",
      error: "selected_slot_not_in_offer_set",
      timing: marks,
      timing_ms: timingMs,
    };
  }

  if (slot.provider === "calendly") {
    const { executeVoiceV2BookOfferedSlotCalendly } = await import("./book-offered-slot-calendly");
    return executeVoiceV2BookOfferedSlotCalendly(raw, workspaceId, {
      agentId: options?.agentId,
      offerSetId,
      selectedSlotId,
      idempotencyKey,
      callId,
      marks,
      timingMs,
      t0,
    });
  }

  const startUtc = new Date(slot.start_utc);
  const endUtc = new Date(slot.end_utc);
  if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "ERROR",
      error: "slot_time_invalid",
      timing: marks,
      timing_ms: timingMs,
    };
  }

  const bookingCfg = await loadMctbAiBookingConfig(workspaceId);
  const connectionId =
    offer.connectionId ||
    (await resolveMctbMicrosoftConnectionId(
      workspaceId,
      bookingCfg.calendarId || bookingCfg.providerConnectionId,
    ));
  if (!connectionId) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return { status: "ERROR", error: "microsoft_connection_not_found", timing: marks, timing_ms: timingMs };
  }

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "microsoft" },
  });
  if (!conn || conn.status !== "connected") {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return { status: "ERROR", error: "microsoft_connection_not_connected", timing: marks, timing_ms: timingMs };
  }
  const config = (conn.config || {}) as CalendarConfig;
  if (!hasOAuthTokens(config)) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return { status: "ERROR", error: "microsoft_oauth_tokens_missing", timing: marks, timing_ms: timingMs };
  }

  marks.SLOT_REVALIDATION_START = isoMark();
  const revalStart = Date.now();
  marks.TOKEN_START = isoMark();
  const tokenStart = Date.now();
  const token = await getValidAccessToken(conn.id, "microsoft", config);
  marks.TOKEN_END = isoMark();
  timingMs.TOKEN_MS = Date.now() - tokenStart;
  if (!token) {
    timingMs.REVALIDATION_MS = Date.now() - revalStart;
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return { status: "ERROR", error: "microsoft_token_unavailable", timing: marks, timing_ms: timingMs };
  }

  beginVoiceV2GraphCollection((span) => graphSpans.push(span));
  const busy = await getMicrosoftBusy(token, startUtc, endUtc, {
    ctx: { connectionId: conn.id, config },
    smtp: config.email,
  });
  if (slotOverlapsBusy(startUtc, endUtc, busy)) {
    endVoiceV2GraphCollection();
    timingMs.REVALIDATION_MS = Date.now() - revalStart;
    marks.SLOT_REVALIDATION_END = isoMark();
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "SLOT_UNAVAILABLE",
      error: "slot_no_longer_available",
      timing: marks,
      timing_ms: timingMs,
    };
  }
  timingMs.REVALIDATION_MS = Date.now() - revalStart;
  marks.SLOT_REVALIDATION_END = isoMark();

  const localConflict = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      status: { not: "cancelled" },
      startsAt: { lte: endUtc },
      endsAt: { gte: startUtc },
    },
  });
  if (localConflict) {
    endVoiceV2GraphCollection();
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "SLOT_UNAVAILABLE",
      error: "slot_conflict_local_ledger",
      timing: marks,
      timing_ms: timingMs,
    };
  }

  if (agentId) {
    const { evaluateBookingIntakeGate } = await import("./intake/booking-gate");
    const gate = await evaluateBookingIntakeGate({
      workspaceId,
      agentId,
      callControlId: callId,
      conversationId: String(raw.conversation_id || raw.telnyx_conversation_id || ""),
      fromE164: String(raw.from || raw.caller || ""),
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
  }

  const appointmentId = createId();
  const spokenLabel = slot.spoken_label || slot.label;
  const spokenConfirmation = `You're booked for ${spokenLabel}.`;

  let intakeNotes = "";
  if (callId) {
    const { resolveSessionKey } = await import("./intake/load-call-context");
    const { getVoiceV2CallContext } = await import("./intake/session-store");
    const { formatIntakeEventNotes } = await import("./intake/format-event-notes");
    const sk = resolveSessionKey({ callControlId: callId, conversationId: null });
    const ctx = sk ? getVoiceV2CallContext(sk) : null;
    if (ctx) {
      intakeNotes = formatIntakeEventNotes(ctx.intakeSchema, ctx.intakeState);
    }
  }

  marks.GRAPH_CREATE_START = isoMark();
  const graphCreateStart = Date.now();
  let eventId: string | null = null;
  try {
    eventId = await insertMicrosoftEvent(
      token,
      {
        summary: `${offer.serviceName} — Voice booking`,
        description: [
          intakeNotes || null,
          `Voice Booking V2 offer_set=${offerSetId} slot=${selectedSlotId}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        start: startUtc,
        end: endUtc,
        timezone: offer.timezone,
        transovoAppointmentId: appointmentId,
        transactionId: idempotencyKey,
      },
      { connectionId: conn.id, config },
    );
  } finally {
    endVoiceV2GraphCollection();
  }
  marks.GRAPH_CREATE_END = isoMark();
  timingMs.GRAPH_CREATE_MS = Date.now() - graphCreateStart;

  if (!eventId) {
    timingMs.TOTAL_BACKEND_MS = Date.now() - t0;
    marks.RESPONSE_SENT = isoMark();
    return {
      status: "ERROR",
      error: "microsoft_event_create_failed",
      timing: marks,
      timing_ms: timingMs,
    };
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
        offer_set_id: offerSetId,
        slot_id: selectedSlotId,
        idempotency_key: idempotencyKey,
      },
    },
  });

  const resultPayload = {
    slot_id: selectedSlotId,
    offer_set_id: offerSetId,
    event_id: eventId,
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
          graph: { GRAPH_REQUEST_COUNT: graphSpans.length, GRAPH_REQUESTS: graphSpans },
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
    graph: { GRAPH_REQUEST_COUNT: graphSpans.length, GRAPH_REQUESTS: graphSpans },
  };
}
