import type { WorkflowState } from "./types";

/** Tools always available regardless of workflow phase. */
export const ESCAPE_HATCH_TOOLS = [
  "get_runtime_context",
  "take_structured_message",
  "escalate_human",
] as const;

/** Irreversible write tools — must complete once started (internal runtime ops). */
export const IRREVERSIBLE_TOOLS = new Set([
  "book_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "send_sms",
]);

/** Direct model-facing webhook tools — published to Telnyx (not runtime_turn). */
const MODEL_FACING_TOOLS = [
  "lookup_customer",
  "take_structured_message",
  "record_current_field",
  "continue_workflow",
  "get_runtime_context",
  "escalate_human",
] as const;

/** Model-facing tools allowed per workflow state. */
export const STATE_ALLOWED_TOOLS: Record<WorkflowState, readonly string[]> = {
  INTENT_DISCOVERY: MODEL_FACING_TOOLS,
  COLLECTING_FIELDS: MODEL_FACING_TOOLS,
  CHECKING_AVAILABILITY: MODEL_FACING_TOOLS,
  SELECTING_SLOT: MODEL_FACING_TOOLS,
  READY_TO_BOOK: MODEL_FACING_TOOLS,
  BOOKING_IN_PROGRESS: MODEL_FACING_TOOLS,
  COMPLETE: MODEL_FACING_TOOLS,
  GENERAL: MODEL_FACING_TOOLS,
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

/** Direct scheduling tools for preprod integration tests only. */
const PREPROD_INTERNAL_SCHEDULING_TOOLS = new Set([
  "calendar_availability",
  "book_appointment",
  "hold_appointment_slot",
  "resolve_datetime",
]);

export function isToolAllowedForState(state: WorkflowState, toolType: string): boolean {
  const canonical = canonicalToolType(toolType);
  if (canonical === "runtime_turn" || toolType === "runtime_turn") {
    return false;
  }
  if (process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS === "1") {
    if (PREPROD_INTERNAL_SCHEDULING_TOOLS.has(canonical) || PREPROD_INTERNAL_SCHEDULING_TOOLS.has(toolType)) {
      return true;
    }
  }
  const allowed = STATE_ALLOWED_TOOLS[state];
  return allowed.includes(canonical) || allowed.includes(toolType);
}
