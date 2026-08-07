import type { WorkflowState } from "./types";

/** Tools always available regardless of workflow phase — via runtime_turn only. */
export const ESCAPE_HATCH_TOOLS = [] as const;

/** Irreversible write tools — must complete once started (internal runtime ops). */
export const IRREVERSIBLE_TOOLS = new Set([
  "book_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "send_sms",
]);

/** Model-facing tools allowed per workflow state — single runtime_turn gateway. */
export const STATE_ALLOWED_TOOLS: Record<WorkflowState, readonly string[]> = {
  INTENT_DISCOVERY: ["runtime_turn"],
  COLLECTING_FIELDS: ["runtime_turn"],
  CHECKING_AVAILABILITY: ["runtime_turn"],
  SELECTING_SLOT: ["runtime_turn"],
  READY_TO_BOOK: ["runtime_turn"],
  BOOKING_IN_PROGRESS: ["runtime_turn"],
  COMPLETE: ["runtime_turn"],
  GENERAL: ["runtime_turn"],
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
