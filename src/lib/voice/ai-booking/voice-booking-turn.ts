import "server-only";

import { resolveCanonicalBookingTimezone } from "@/lib/mctb/ai-booking/booking-timezone";
import { runSchedulingSpecialistAgent } from "@/lib/mctb/ai-booking/agents/scheduling-specialist";
import { mapSpecialistToOrchestratorInput } from "@/lib/mctb/ai-booking/agents/map-to-orchestrator";
import { orchestrateMctbAiBooking } from "@/lib/mctb/ai-booking/orchestrator";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { formatMctbBookingSlotLabel } from "@/lib/mctb/ai-booking/offered-slot-selection";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import { voiceBookingConversationId } from "@/lib/voice/ai-booking/constants";
import {
  loadVoiceCallBookingContext,
  nextVoiceBookingWriteEpoch,
} from "@/lib/voice/ai-booking/call-context";
import { logVoiceAiBookingEvent } from "@/lib/voice/ai-booking/observability";
import { isVoiceCanonicalAiBookingActive } from "@/lib/voice/ai-booking/mode";
import type { AiBookingOrchestratorResult, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import type { OrchestrateAiBookingInput } from "@/lib/mctb/ai-booking/orchestrator";

function shouldFastPathGenericAvailability(
  utterance: string,
  offeredSlots: MctbBookingSlot[],
  opts: { offeredSlotId?: string | null; confirmBooking?: boolean },
): boolean {
  if (opts.offeredSlotId?.trim() || opts.confirmBooking) return false;
  if (offeredSlots.length > 0) return false;
  const t = utterance.toLowerCase().trim();
  if (!t) return true;
  if (
    /\b(mon(day)?|tues(day)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?|sun(day)?)\b/.test(
      t,
    )
  ) {
    return false;
  }
  if (/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(t)) return false;
  if (/\b(tomorrow|today|next week|this week)\b/i.test(t)) return false;
  return /\b(book|schedule|appointment|scheduling|set up|come out|availability|see someone|visit)\b/i.test(
    t,
  );
}

function voiceSpeakFromOrchestrator(
  result: AiBookingOrchestratorResult,
  mappedSelectedSlotId?: string | null,
) {
  if (result.kind === "booked") {
    const label = formatMctbBookingSlotLabel({
      slotId: mappedSelectedSlotId || "",
      startUtc: result.booking.startUtc,
      endUtc: result.booking.endUtc,
      timezone: result.booking.timezone,
    });
    return {
      ok: true,
      speak: result.messageHint || `You're booked for ${label}.`,
      data: {
        booked: true,
        provider_booking_id: result.booking.providerBookingId,
        start_time: result.booking.startUtc,
      },
    };
  }

  if (result.kind === "offer_slots") {
    const labels = result.slots.map(formatMctbBookingSlotLabel).join(", ");
    return {
      ok: true,
      speak: result.messageHint || `I have ${labels}. Which works best?`,
      data: {
        slots: result.slots.map((s, i) => ({
          index: i + 1,
          slot_id: s.slotId,
          label: formatMctbBookingSlotLabel(s),
        })),
      },
    };
  }

  if (result.kind === "specific_time") {
    return {
      ok: true,
      speak: result.messageHint,
      data: { specific_time: true, requestedAvailable: result.requestedAvailable },
    };
  }

  if (result.kind === "timezone_conflict") {
    return {
      ok: false,
      speak:
        "I hit a scheduling configuration issue and can't book on this call. I can have someone follow up.",
      error: "BOOKING_TIMEZONE_CONFLICT",
    };
  }

  return {
    ok: true,
    speak:
      result.kind === "need_clarification"
        ? result.messageHint
        : result.kind === "fallback_link"
          ? result.messageHint
          : "Let me know another time that might work.",
    data: { result_kind: result.kind },
  };
}

export async function executeVoiceAiBookingTurn(input: {
  workspaceId: string;
  agentId?: string | null;
  callId: string;
  utterance: string;
  confirmBooking?: boolean;
  offeredSlotId?: string | null;
}) {
  const active = await isVoiceCanonicalAiBookingActive({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });
  if (!active) {
    return {
      ok: false,
      speak:
        "I can text you our booking link to schedule, if you'd like — just say you'd like the link by text.",
      error: "voice_ai_booking_not_active",
    };
  }

  const readiness = await evaluateMctbAiBookingReadiness(input.workspaceId);
  if (!readiness.ready) {
    return {
      ok: true,
      speak: readiness.fallbackUrl
        ? "I'm having trouble checking the calendar right now. I can text you our booking link instead — is that okay?"
        : "I'm having trouble checking the calendar right now. I can take your preferred time and have someone call you back.",
      data: { fallback: true, fallbackUrl: readiness.fallbackUrl },
    };
  }

  const conversationId = voiceBookingConversationId(input.callId);
  const bookingTimezone = await resolveCanonicalBookingTimezone(input.workspaceId);
  const caller = await loadVoiceCallBookingContext({
    workspaceId: input.workspaceId,
    callId: input.callId,
  });
  const session = await getMctbAiBookingSessionStore().get(conversationId);
  const offeredSlots = session?.offeredSlots ?? [];

  if (
    shouldFastPathGenericAvailability(input.utterance, offeredSlots, {
      offeredSlotId: input.offeredSlotId,
      confirmBooking: input.confirmBooking,
    })
  ) {
    const now = new Date();
    const orchestrateInput: OrchestrateAiBookingInput = {
      workspaceId: input.workspaceId,
      conversationId,
      contactId: caller.contactId,
      customerName: caller.customerName,
      customerPhone: caller.customerPhone,
      customerEmail: caller.customerEmail,
      timezone: bookingTimezone,
      windowStartUtc: now.toISOString(),
      windowEndUtc: new Date(now.getTime() + 48 * 3600_000).toISOString(),
      specificTimeUtc: null,
      confirmBooking: false,
    };
    logVoiceAiBookingEvent("voice_turn_fast_availability", {
      workspaceId: input.workspaceId,
      callId: input.callId,
      conversationId,
      utterance: input.utterance.slice(0, 120),
    });
    const result = await orchestrateMctbAiBooking(orchestrateInput);
    return voiceSpeakFromOrchestrator(result);
  }

  const { buildMctbSemanticConversationContext, schedulingSpecialistContextExtras } =
    await import("@/lib/mctb/semantic-conversation-context");
  const semanticContext = await buildMctbSemanticConversationContext({
    workspaceId: input.workspaceId,
    conversationId,
    latestCustomerMessage: input.utterance,
  });
  const extras = await schedulingSpecialistContextExtras({
    workspaceId: input.workspaceId,
    timezone: bookingTimezone,
  });

  const specialist = await runSchedulingSpecialistAgent({
    message: input.utterance,
    timezone: bookingTimezone,
    nowIso: new Date().toISOString(),
    offeredSlots,
    aiBookingSessionActive: offeredSlots.length > 0,
    sessionStage: session?.stage,
    session,
    bookingAuthorized: true,
    semanticContext,
    bookingConfig: extras.bookingConfig,
  });

  if (input.offeredSlotId?.trim()) {
    specialist.action = "SELECT_OFFERED_SLOT";
    specialist.offered_slot_id = input.offeredSlotId.trim();
  }
  if (input.confirmBooking) {
    specialist.customer_confirms_booking = true;
    if (specialist.action === "SELECT_OFFERED_SLOT") {
      specialist.action = "CONFIRM_BOOKING";
    }
  }

  const mapped = mapSpecialistToOrchestratorInput(
    specialist,
    {
      workspaceId: input.workspaceId,
      conversationId,
      contactId: caller.contactId,
      customerName: caller.customerName,
      customerPhone: caller.customerPhone,
      customerEmail: caller.customerEmail,
      timezone: bookingTimezone,
      customerMessage: input.utterance,
    },
    {
      sessionHasOfferedSlots: offeredSlots.length > 0,
      offeredSlots,
      referenceUtcIso: new Date().toISOString(),
    },
  );

  if (!mapped) {
    return {
      ok: true,
      speak:
        specialist.clarification_text ||
        "What day or time works best for you?",
      data: { needs_clarification: true },
    };
  }

  const writeEpoch =
    mapped.confirmBooking && mapped.selectedSlotId
      ? await nextVoiceBookingWriteEpoch(input.callId)
      : mapped.writeEpoch;

  logVoiceAiBookingEvent("voice_turn_orchestrate", {
    workspaceId: input.workspaceId,
    callId: input.callId,
    conversationId,
    action: specialist.action,
    selectedSlotId: mapped.selectedSlotId,
    confirmBooking: mapped.confirmBooking,
  });

  const result = await orchestrateMctbAiBooking({
    ...mapped,
    writeEpoch,
  });

  return voiceSpeakFromOrchestrator(result, mapped.selectedSlotId);
}
