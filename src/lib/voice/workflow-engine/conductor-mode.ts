import type { VoiceAgentConfig } from "@/lib/voice/types";

/** Telnyx internal-booking test — runtime conductor owns workflow; LLM only speaks. */
export const CONDUCTOR_PUBLISHED_WEBHOOK_TOOLS = [
  "runtime_turn",
  "take_structured_message",
  "escalate_human",
] as const;

export const CONDUCTOR_INTERNAL_WORKFLOW_TOOLS = new Set([
  "continue_workflow",
  "get_runtime_context",
  "record_current_field",
  "get_workflow_requirements",
  "save_collected_fields",
  "calendar_availability",
  "book_appointment",
  "hold_appointment_slot",
  "release_appointment_hold",
  "lookup_customer",
]);

export function isInternalBookingConductorMode(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return (
    advanced.internalBookingConductorMode === true ||
    advanced.internalBookingTestMode === true ||
    advanced.voiceArchitectureVersion === "telnyx-internal-booking-test-v1"
  );
}

export const CONDUCTOR_RUNTIME_AUTHORITY = [
  "DETERMINISTIC BOOKING CONDUCTOR (Telnyx internal calendar test):",
  "On every caller turn, call runtime_turn exactly once with:",
  "  utterance = the caller's latest words (verbatim)",
  "  interpreted_intent = your best intent label (capability_question | booking_intent | availability_question | confirmation | field_answer | transfer | take_message | end_call | general_question)",
  "Do NOT call continue_workflow, get_runtime_context, record_current_field, calendar_availability, or book_appointment — the runtime owns those steps.",
  "Speak naturally using the speak line returned by runtime_turn. Never invent booking results.",
  "Capability questions ('Can you book an appointment?') → interpreted_intent=capability_question. Do not check the calendar.",
  "Actual booking requests ('I need to book…') → interpreted_intent=booking_intent.",
  "When runtime_turn returns current_field, ask only for that field — do not skip ahead to availability.",
].join("\n");
