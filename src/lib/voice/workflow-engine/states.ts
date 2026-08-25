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

/** Direct tool access for preprod integration tests (production uses runtime_turn only). */
const PREPROD_LEGACY_TOOLS = new Set([
  "get_runtime_context",
  "get_workflow_requirements",
  "record_current_field",
  "save_collected_fields",
  "continue_workflow",
  "lookup_customer",
  "take_structured_message",
  "escalate_human",
  "calendar_availability",
  "book_appointment",
  "hold_appointment_slot",
]);

export function isToolAllowedForState(state: WorkflowState, toolType: string): boolean {
  const canonical = canonicalToolType(toolType);
  if (process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS === "1") {
    if (canonical === "runtime_turn" || toolType === "runtime_turn") return true;
    if (PREPROD_LEGACY_TOOLS.has(canonical) || PREPROD_LEGACY_TOOLS.has(toolType)) return true;
  }
  const allowed = STATE_ALLOWED_TOOLS[state];
  return allowed.includes(canonical) || allowed.includes(toolType);
}
