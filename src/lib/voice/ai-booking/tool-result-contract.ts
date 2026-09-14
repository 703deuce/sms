/**
 * Explicit Telnyx-facing contract for voice_ai_booking_turn.
 * The assistant must not infer success/failure from ambiguous text.
 */

export const VOICE_BOOKING_TOOL_STATUSES = [
  "OPERATION_PENDING",
  "AVAILABILITY_FOUND",
  "NO_AVAILABILITY",
  "NEEDS_CLARIFICATION",
  "BOOKING_CONFIRMED",
  "SLOT_NO_LONGER_AVAILABLE",
  "PROVIDER_TEMPORARY_FAILURE",
  "PROVIDER_AUTH_FAILURE",
  "STALE_ACTION",
  "OPERATION_FAILED",
] as const;

export type VoiceBookingToolStatus = (typeof VOICE_BOOKING_TOOL_STATUSES)[number];

export type VoiceBookingSlotPayload = {
  slot_id: string;
  label: string;
  index?: number;
  start_time?: string;
};

export function formatVoiceAiBookingToolResponse(input: {
  status: VoiceBookingToolStatus;
  speak: string;
  ok?: boolean;
  operationId?: string | null;
  slots?: VoiceBookingSlotPayload[];
  error?: string | null;
  data?: Record<string, unknown>;
  agentInstruction?: string | null;
}): Record<string, unknown> {
  const ok =
    input.ok ??
    (input.status === "AVAILABILITY_FOUND" ||
      input.status === "BOOKING_CONFIRMED" ||
      input.status === "OPERATION_PENDING" ||
      input.status === "NEEDS_CLARIFICATION");

  const slots = input.slots ?? [];
  const agentInstruction =
    input.agentInstruction ??
    (input.status === "OPERATION_PENDING"
      ? "Voice runtime owns this operation. Do not poll tools. Wait for authoritative availability injection or continue natural conversation."
      : input.status === "AVAILABILITY_FOUND"
        ? "Speak the offered times exactly as in speak and slots. Ask which time works. When the caller chooses, call voice_ai_booking_turn with offered_slot_id from slots."
        : null);

  return {
    ok,
    status: input.status,
    voice_booking_status: input.status,
    result: input.status,
    speak: input.speak,
    ...(input.operationId ? { operation_id: input.operationId, operationId: input.operationId } : {}),
    ...(input.error ? { error: input.error } : {}),
    ...(agentInstruction ? { agent_instruction: agentInstruction } : {}),
    data: {
      ...(input.data || {}),
      voice_booking_status: input.status,
      ...(slots.length ? { slots } : {}),
      ...(input.operationId ? { operation_id: input.operationId } : {}),
    },
    ...(slots.length
      ? {
          slots,
          offered_slot_ids: slots.map((s) => s.slot_id),
        }
      : {}),
  };
}

export function voiceBookingResponseFromDurableTurn(input: {
  operationStatus: string;
  speak: string;
  operationId: string;
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}): Record<string, unknown> {
  if (
    input.operationStatus === "PENDING" ||
    input.operationStatus === "CLAIMED" ||
    input.operationStatus === "PROCESSING" ||
    input.operationStatus === "WAITING_PROVIDER" ||
    input.operationStatus === "FAILED_RETRYABLE"
  ) {
    return formatVoiceAiBookingToolResponse({
      status: "OPERATION_PENDING",
      speak: input.speak,
      ok: true,
      operationId: input.operationId,
      data: input.data,
    });
  }

  if (input.operationStatus === "SUCCEEDED") {
    const voice = (input.data?.voice || input.data) as Record<string, unknown> | undefined;
    const inner = (voice || {}) as Record<string, unknown>;
    const innerData = (inner.data || {}) as Record<string, unknown>;
    if (innerData.booked) {
      return formatVoiceAiBookingToolResponse({
        status: "BOOKING_CONFIRMED",
        speak: String(inner.speak || input.speak),
        ok: true,
        operationId: input.operationId,
        data: innerData as Record<string, unknown>,
      });
    }
    const rawSlots = Array.isArray(innerData.slots)
      ? (innerData.slots as Array<Record<string, unknown>>)
      : [];
    if (rawSlots.length) {
      const slots: VoiceBookingSlotPayload[] = rawSlots.map((s, i) => ({
        slot_id: String(s.slot_id || s.slotId || ""),
        label: String(s.label || ""),
        index: Number(s.index ?? i + 1),
        start_time: s.start_time ? String(s.start_time) : undefined,
      }));
      return formatVoiceAiBookingToolResponse({
        status: "AVAILABILITY_FOUND",
        speak: String(inner.speak || input.speak),
        ok: true,
        operationId: input.operationId,
        slots,
        data: innerData as Record<string, unknown>,
      });
    }
    if (innerData.needs_clarification) {
      return formatVoiceAiBookingToolResponse({
        status: "NEEDS_CLARIFICATION",
        speak: String(inner.speak || input.speak),
        ok: true,
        operationId: input.operationId,
        data: innerData as Record<string, unknown>,
      });
    }
  }

  if (input.error?.includes("not_ready") || input.error?.includes("disconnected")) {
    return formatVoiceAiBookingToolResponse({
      status: "PROVIDER_AUTH_FAILURE",
      speak: input.speak,
      ok: false,
      operationId: input.operationId,
      error: input.error,
    });
  }

  return formatVoiceAiBookingToolResponse({
    status: "PROVIDER_TEMPORARY_FAILURE",
    speak: input.speak,
    ok: false,
    operationId: input.operationId,
    error: input.error || "OPERATION_FAILED",
  });
}

export function voiceBookingResponseFromSyncTurn(result: Record<string, unknown>): Record<string, unknown> {
  const data = (result.data || {}) as Record<string, unknown>;
  const speak = String(result.speak || "");
  const error = result.error ? String(result.error) : null;

  if (result.ok === false && error) {
    if (error.includes("not_ready") || error.includes("disconnected")) {
      return formatVoiceAiBookingToolResponse({
        status: "PROVIDER_AUTH_FAILURE",
        speak,
        ok: false,
        error,
        data,
      });
    }
    return formatVoiceAiBookingToolResponse({
      status: "PROVIDER_TEMPORARY_FAILURE",
      speak,
      ok: false,
      error,
      data,
    });
  }

  if (data.booked) {
    return formatVoiceAiBookingToolResponse({
      status: "BOOKING_CONFIRMED",
      speak,
      ok: true,
      data,
    });
  }

  const rawSlots = Array.isArray(data.slots) ? (data.slots as Array<Record<string, unknown>>) : [];
  if (rawSlots.length) {
    const slots: VoiceBookingSlotPayload[] = rawSlots.map((s, i) => ({
      slot_id: String(s.slot_id || s.slotId || ""),
      label: String(s.label || ""),
      index: Number(s.index ?? i + 1),
    }));
    return formatVoiceAiBookingToolResponse({
      status: "AVAILABILITY_FOUND",
      speak,
      ok: true,
      slots,
      data,
    });
  }

  if (data.needs_clarification) {
    return formatVoiceAiBookingToolResponse({
      status: "NEEDS_CLARIFICATION",
      speak,
      ok: true,
      data,
    });
  }

  return formatVoiceAiBookingToolResponse({
    status: "NO_AVAILABILITY",
    speak: speak || "I could not find openings in that window.",
    ok: true,
    data,
  });
}
