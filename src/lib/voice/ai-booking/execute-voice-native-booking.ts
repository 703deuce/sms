import "server-only";

import { resolveCanonicalBookingTimezone } from "@/lib/mctb/ai-booking/booking-timezone";
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
import type { AiBookingOrchestratorResult } from "@/lib/mctb/ai-booking/types";
import { resolveVoiceBookingMode } from "@/lib/voice/ai-booking/mode";
import { mapVoiceNativeActionToOrchestrator } from "@/lib/voice/ai-booking/map-voice-native-to-orchestrator";
import type { VoiceNativeBookingPayload } from "@/lib/voice/ai-booking/voice-native-booking-types";

export type VoiceNativeBookingLatency = {
  ingressMs: number;
  orchestratorMs: number;
  totalMs: number;
};

function voiceSpeakFromOrchestrator(
  result: AiBookingOrchestratorResult,
  mappedSelectedSlotId?: string | null,
  offerSetId?: string | null,
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
        offer_set_id: offerSetId,
      },
    };
  }

  if (result.kind === "offer_slots") {
    const labels = result.slots.map(formatMctbBookingSlotLabel).join(", ");
    return {
      ok: true,
      speak: result.messageHint || `I have ${labels}. Which works best?`,
      data: {
        offer_set_id: offerSetId,
        slots: result.slots.map((s, i) => ({
          index: i + 1,
          slot_id: s.slotId,
          label: formatMctbBookingSlotLabel(s),
          start_time: s.startUtc,
        })),
      },
    };
  }

  if (result.kind === "specific_time") {
    return {
      ok: true,
      speak: result.messageHint,
      data: { specific_time: true, requestedAvailable: result.requestedAvailable, offer_set_id: offerSetId },
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
    data: { result_kind: result.kind, offer_set_id: offerSetId },
  };
}

/**
 * Voice-native booking path: structured action → canonical orchestrator (no Scheduling Specialist LLM).
 */
export async function executeVoiceNativeBookingAction(input: {
  workspaceId: string;
  agentId?: string | null;
  callId: string;
  payload: VoiceNativeBookingPayload;
  actionEpochAtEnqueue?: number | null;
}) {
  const started = Date.now();
  const mode = await resolveVoiceBookingMode({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });
  if (mode !== "AI_BOOK") {
    return {
      ok: false,
      speak:
        "I can text you our booking link to schedule, if you'd like — just say you'd like the link by text.",
      error: "voice_ai_booking_not_active",
      data: { resolvedMode: mode },
      latency: { ingressMs: Date.now() - started, orchestratorMs: 0, totalMs: Date.now() - started },
    };
  }

  const readiness = await evaluateMctbAiBookingReadiness(input.workspaceId);
  if (!readiness.ready) {
    const blocker = readiness.reason || "not_ready";
    logVoiceAiBookingEvent("voice_native_not_ready", {
      workspaceId: input.workspaceId,
      callId: input.callId,
      reason: blocker,
    });
    return {
      ok: false,
      speak:
        "I'm not able to check live calendar availability on this call right now. I can take your preferred time and have someone call you back to confirm.",
      error: `ai_booking_not_ready:${blocker}`,
      data: { readiness, resolvedMode: "AI_BOOK" },
      latency: { ingressMs: Date.now() - started, orchestratorMs: 0, totalMs: Date.now() - started },
    };
  }

  const ingressMs = Date.now() - started;
  const conversationId = voiceBookingConversationId(input.callId);
  const bookingTimezone = await resolveCanonicalBookingTimezone(input.workspaceId);
  const caller = await loadVoiceCallBookingContext({
    workspaceId: input.workspaceId,
    callId: input.callId,
  });
  const sessionStore = getMctbAiBookingSessionStore();
  const session = await sessionStore.get(conversationId);
  const referenceUtcIso = new Date().toISOString();

  if (input.payload.action === "CANCEL_BOOKING_FLOW") {
    await sessionStore.clear(conversationId);
    return {
      ok: true,
      speak: "No problem — we can skip scheduling for now.",
      data: { cancelled: true, voice_native: true },
      latency: { ingressMs, orchestratorMs: 0, totalMs: Date.now() - started },
    };
  }

  const mapped = mapVoiceNativeActionToOrchestrator({
    payload: input.payload,
    session,
    bookingTimezone,
    referenceUtcIso,
    base: {
      workspaceId: input.workspaceId,
      conversationId,
      contactId: caller.contactId,
      customerName: caller.customerName,
      customerPhone: caller.customerPhone,
      customerEmail: caller.customerEmail,
      timezone: bookingTimezone,
      customerMessage: `voice_native:${input.payload.action}`,
    },
  });

  if (mapped.kind === "cancelled") {
    await sessionStore.clear(conversationId);
    return {
      ok: true,
      speak: "No problem — we can skip scheduling for now.",
      data: { cancelled: true },
      latency: { ingressMs, orchestratorMs: 0, totalMs: Date.now() - started },
    };
  }

  if (mapped.kind === "invalid_offer_set" || mapped.kind === "invalid_slot") {
    return {
      ok: true,
      speak: mapped.message,
      data: { needs_clarification: true, voice_native: true },
      latency: { ingressMs, orchestratorMs: 0, totalMs: Date.now() - started },
    };
  }

  if (mapped.kind === "needs_clarification") {
    return {
      ok: true,
      speak: mapped.message,
      data: { needs_clarification: true, voice_native: true },
      latency: { ingressMs, orchestratorMs: 0, totalMs: Date.now() - started },
    };
  }

  const orchInput = mapped.input;
  const writeEpoch =
    orchInput.confirmBooking && orchInput.selectedSlotId
      ? await nextVoiceBookingWriteEpoch(input.callId)
      : input.actionEpochAtEnqueue ?? undefined;

  logVoiceAiBookingEvent("voice_native_orchestrate", {
    workspaceId: input.workspaceId,
    callId: input.callId,
    conversationId,
    action: input.payload.action,
    selectedSlotId: orchInput.selectedSlotId,
    confirmBooking: orchInput.confirmBooking,
  });

  const orchStart = Date.now();
  const result = await orchestrateMctbAiBooking({
    ...orchInput,
    writeEpoch,
  });
  const orchestratorMs = Date.now() - orchStart;

  const refreshed = await sessionStore.get(conversationId);
  const offerSetId = refreshed?.offerSetId ?? session?.offerSetId ?? null;

  const voice = voiceSpeakFromOrchestrator(result, orchInput.selectedSlotId, offerSetId);
  return {
    ...voice,
    data: {
      ...(voice.data || {}),
      voice_native: true,
      voice_native_action: input.payload.action,
      latency_ms: {
        ingress: ingressMs,
        orchestrator: orchestratorMs,
        total: Date.now() - started,
      },
    },
    latency: {
      ingressMs,
      orchestratorMs,
      totalMs: Date.now() - started,
    },
  };
}
