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

/** Irreversible write tools — must complete once started (internal runtime ops). */
export const IRREVERSIBLE_TOOLS = new Set([
  "book_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "send_sms",
]);

/** Model-facing tools allowed per workflow state. Scheduling runs via continue_workflow internally. */
export const STATE_ALLOWED_TOOLS: Record<WorkflowState, readonly string[]> = {
  INTENT_DISCOVERY: [
    "record_current_field",
    "continue_workflow",
    "get_runtime_context",
    ...ESCAPE_HATCH_TOOLS,
  ],
  COLLECTING_FIELDS: [
    "record_current_field",
    "continue_workflow",
    "get_runtime_context",
    ...ESCAPE_HATCH_TOOLS,
  ],
  CHECKING_AVAILABILITY: [
    "continue_workflow",
    "get_runtime_context",
    ...ESCAPE_HATCH_TOOLS,
  ],
  SELECTING_SLOT: [
    "continue_workflow",
    "get_runtime_context",
    ...ESCAPE_HATCH_TOOLS,
  ],
  READY_TO_BOOK: [
    "continue_workflow",
    "get_runtime_context",
    ...ESCAPE_HATCH_TOOLS,
  ],
  BOOKING_IN_PROGRESS: [
    "continue_workflow",
    "get_runtime_context",
  ],
  COMPLETE: [
    "continue_workflow",
    "get_runtime_context",
    ...ESCAPE_HATCH_TOOLS,
  ],
  GENERAL: [
    "record_current_field",
    "continue_workflow",
    "get_runtime_context",
    "lookup_customer",
    "take_structured_message",
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
