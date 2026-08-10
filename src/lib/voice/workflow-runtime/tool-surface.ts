/**
 * Split between tools the LLM should choose (conversational/business)
 * and runtime plumbing that the server handles automatically.
 */
export const RUNTIME_ONLY_TOOL_NAMES = new Set([
  "get_booking_requirements",
  "record_current_field",
  "record_fields",
]);

/** Internal tools the runtime may execute — never offered to the LLM directly. */
export const DETERMINISTIC_EXECUTION_TOOL_NAMES = new Set([
  "lookup_customer",
  "validate_eligibility",
  "classify_intent",
  "check_availability",
  "find_appointments",
]);

/** Tools exposed to the LiveKit model for judgment-based actions (legacy internal names). */
export const CONVERSATIONAL_TOOL_NAMES = new Set([
  "submit_caller_information",
  "select_slot",
  "confirm_booking",
  "get_business_answer",
  "detect_caller_intent",
  "reschedule_appointment",
  "cancel_appointment",
  "take_message",
  "save_message",
  "request_human",
  "end_call",
  "modify_appointment",
]);

/** Semantic names shown to the model (see agent-runtime/semantic-tool-surface.ts). */
export const SEMANTIC_CONVERSATIONAL_TOOL_NAMES = new Set([
  "capture_caller_information",
  "choose_appointment_time",
  "confirm_action",
  "answer_business_question",
  "detect_caller_intent",
  "modify_appointment",
  "take_message",
  "transfer_to_human",
  "end_call",
]);

export function filterConversationalTools(toolNames: string[]): string[] {
  return toolNames.filter(
    (name) =>
      CONVERSATIONAL_TOOL_NAMES.has(name) &&
      !RUNTIME_ONLY_TOOL_NAMES.has(name) &&
      !DETERMINISTIC_EXECUTION_TOOL_NAMES.has(name),
  );
}

export function isRuntimeOnlyTool(toolName: string): boolean {
  return RUNTIME_ONLY_TOOL_NAMES.has(toolName);
}
