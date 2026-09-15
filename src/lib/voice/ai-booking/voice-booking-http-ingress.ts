import "server-only";

import type { VoiceNativeBookingPayload } from "@/lib/voice/ai-booking/voice-native-booking-types";
import { parseVoiceNativeBookingPayload } from "@/lib/voice/ai-booking/voice-native-booking-types";

export type VoiceBookingIngressMarks = {
  requestReceivedAt: number;
  authCompleteAt?: number;
  callContextResolvedAt?: number;
  durableOpCreatedAt?: number;
  enqueuedAt?: number;
  httpResponseAt?: number;
};

export function voiceLegacyUtteranceBookingEnabled(): boolean {
  return process.env.VOICE_LEGACY_UTTERANCE_BOOKING === "1";
}

/**
 * HTTP ingress must only accept structured Telnyx args unless legacy bridge is explicitly enabled.
 * Legacy utterance bridging (timezone, default date) runs in the worker — not on the webhook ACK path.
 */
export function resolveVoiceNativePayloadOnHttpIngress(
  raw: Record<string, unknown>,
): VoiceNativeBookingPayload | null {
  const parsed = parseVoiceNativeBookingPayload(raw);
  if (parsed.ok) return parsed.payload;

  if (!voiceLegacyUtteranceBookingEnabled()) {
    return null;
  }

  const utterance = String(raw.utterance || raw.user_input || raw.caller_message || "").trim();
  const offeredSlotId = raw.offered_slot_id ? String(raw.offered_slot_id).trim() : "";
  const confirm = raw.confirm_booking === true || raw.confirm === true;

  if (offeredSlotId) {
    return {
      action: confirm ? "BOOK_OFFERED_SLOT" : "SELECT_OFFERED_SLOT",
      offer_set_id: raw.offer_set_id ? String(raw.offer_set_id) : null,
      selected_slot_id: offeredSlotId,
      confirm_booking: confirm,
      tool_invocation_id: raw.tool_invocation_id
        ? String(raw.tool_invocation_id)
        : raw.invocation_id
          ? String(raw.invocation_id)
          : null,
    };
  }

  if (!utterance) return null;

  return {
    action: "FIND_AVAILABILITY",
    requested_date: null,
    tool_invocation_id: raw.tool_invocation_id
      ? String(raw.tool_invocation_id)
      : raw.invocation_id
        ? String(raw.invocation_id)
        : null,
    legacy_utterance_deferred: true,
  } as VoiceNativeBookingPayload & { legacy_utterance_deferred?: boolean };
}

export function ingressTimingSummary(marks: VoiceBookingIngressMarks): Record<string, number> {
  const authMs =
    marks.authCompleteAt != null ? marks.authCompleteAt - marks.requestReceivedAt : 0;
  const contextMs =
    marks.callContextResolvedAt != null && marks.authCompleteAt != null
      ? marks.callContextResolvedAt - marks.authCompleteAt
      : 0;
  const durableMs =
    marks.durableOpCreatedAt != null && marks.callContextResolvedAt != null
      ? marks.durableOpCreatedAt - marks.callContextResolvedAt
      : 0;
  const enqueueMs =
    marks.enqueuedAt != null && marks.durableOpCreatedAt != null
      ? marks.enqueuedAt - marks.durableOpCreatedAt
      : 0;
  const totalAckMs =
    marks.httpResponseAt != null
      ? marks.httpResponseAt - marks.requestReceivedAt
      : Date.now() - marks.requestReceivedAt;

  return {
    AUTH_MS: authMs,
    CONTEXT_RESOLUTION_MS: contextMs,
    DURABLE_CREATE_MS: durableMs,
    ENQUEUE_MS: enqueueMs,
    TOTAL_ACK_MS: totalAckMs,
  };
}

export function logVoiceBookingIngressTiming(
  marks: VoiceBookingIngressMarks,
  extra?: Record<string, unknown>,
) {
  const summary = ingressTimingSummary(marks);
  console.info(
    "[voice/booking-http-ingress]",
    JSON.stringify({
      REQUEST_RECEIVED_AT: marks.requestReceivedAt,
      AUTH_COMPLETE_AT: marks.authCompleteAt,
      CALL_CONTEXT_RESOLVED_AT: marks.callContextResolvedAt,
      DURABLE_OP_CREATED_AT: marks.durableOpCreatedAt,
      ENQUEUED_AT: marks.enqueuedAt,
      HTTP_RESPONSE_AT: marks.httpResponseAt,
      ...summary,
      ...extra,
    }),
  );
}
