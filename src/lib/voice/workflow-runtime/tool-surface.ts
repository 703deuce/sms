/**
 * Split between tools the LLM should choose (conversational/business)
 * and runtime plumbing that the server handles automatically.
 */
export const RUNTIME_ONLY_TOOL_NAMES = new Set([
  "get_booking_requirements",
  "record_current_field",
  "record_fields",
]);

/** Tools exposed to the LiveKit model for judgment-based actions. */
export const CONVERSATIONAL_TOOL_NAMES = new Set([
  "submit_caller_information",
  "check_availability",
  "select_slot",
  "confirm_booking",
  "get_business_answer",
  "detect_caller_intent",
  "lookup_customer",
  "validate_eligibility",
  "classify_intent",
  "find_appointments",
  "reschedule_appointment",
  "cancel_appointment",
  "take_message",
  "save_message",
  "request_human",
  "end_call",
]);

export function filterConversationalTools(toolNames: string[]): string[] {
  return toolNames.filter(
    (name) => CONVERSATIONAL_TOOL_NAMES.has(name) && !RUNTIME_ONLY_TOOL_NAMES.has(name),
  );
}

export function isRuntimeOnlyTool(toolName: string): boolean {
  return RUNTIME_ONLY_TOOL_NAMES.has(toolName);
}
