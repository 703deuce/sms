import type { WorkflowState } from "./types";

/** Tools always available regardless of workflow phase. */
export const ESCAPE_HATCH_TOOLS = [
  "transfer",
  "escalate_human",
  "take_structured_message",
  "hangup",
  "lookup_customer",
  "get_runtime_context",
] as const;

/** Irreversible write tools — must complete once started. */
export const IRREVERSIBLE_TOOLS = new Set([
  "book_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "send_sms",
]);

/** Allowed builtin tool types per workflow state. */
export const STATE_ALLOWED_TOOLS: Record<WorkflowState, readonly string[]> = {
  INTENT_DISCOVERY: [
    "lookup_customer",
    "get_runtime_context",
    "get_workflow_requirements",
    "record_current_field",
    "save_collected_fields",
    "resolve_datetime",
    "calendar_availability",
    ...ESCAPE_HATCH_TOOLS,
  ],
  COLLECTING_FIELDS: [
    "record_current_field",
    "save_collected_fields",
    "get_workflow_requirements",
    "get_runtime_context",
    "resolve_datetime",
    "calendar_availability",
    ...ESCAPE_HATCH_TOOLS,
  ],
  CHECKING_AVAILABILITY: [
    "resolve_datetime",
    "calendar_availability",
    "check_availability",
    "get_workflow_requirements",
    "get_runtime_context",
    "record_current_field",
    "save_collected_fields",
    ...ESCAPE_HATCH_TOOLS,
  ],
  SELECTING_SLOT: [
    "resolve_datetime",
    "calendar_availability",
    "check_availability",
    "hold_appointment_slot",
    "release_appointment_hold",
    "get_workflow_requirements",
    "get_runtime_context",
    "record_current_field",
    "save_collected_fields",
    ...ESCAPE_HATCH_TOOLS,
  ],
  READY_TO_BOOK: [
    "hold_appointment_slot",
    "release_appointment_hold",
    "book_appointment",
    "get_workflow_requirements",
    "get_runtime_context",
    ...ESCAPE_HATCH_TOOLS,
  ],
  BOOKING_IN_PROGRESS: [
    "book_appointment",
    "get_runtime_context",
  ],
  COMPLETE: [
    "send_sms",
    "find_appointments",
    "reschedule_appointment",
    "cancel_appointment",
    "get_runtime_context",
    "get_workflow_requirements",
    ...ESCAPE_HATCH_TOOLS,
  ],
  GENERAL: [
    "record_current_field",
    "save_collected_fields",
    "get_workflow_requirements",
    "get_runtime_context",
    "resolve_datetime",
    "calendar_availability",
    "check_availability",
    "lookup_customer",
    "take_structured_message",
    "send_sms",
    "transfer",
    "escalate_human",
    "hangup",
  ],
};

/** Legacy aliases map to canonical tool types for guard checks. */
export const TOOL_TYPE_ALIASES: Record<string, string> = {
  check_availability: "calendar_availability",
  save_caller_info: "save_collected_fields",
  save_customer_info: "save_collected_fields",
  check_customer_fields: "get_workflow_requirements",
  check_field_requirements: "get_workflow_requirements",
};

export function canonicalToolType(toolType: string): string {
  return TOOL_TYPE_ALIASES[toolType] || toolType;
}

export function toolsForState(state: WorkflowState): string[] {
  return [...STATE_ALLOWED_TOOLS[state]];
}

export function isToolAllowedForState(state: WorkflowState, toolType: string): boolean {
  const canonical = canonicalToolType(toolType);
  const allowed = STATE_ALLOWED_TOOLS[state];
  return allowed.includes(canonical) || allowed.includes(toolType);
}
