import { STATE_ALLOWED_TOOLS } from "./states";

/** Union of all tools the runtime may invoke internally during a booking call. */
export const CALLER_AMY_WORKFLOW_TOOL_UNION: readonly string[] = [
  ...new Set(
    Object.values(STATE_ALLOWED_TOOLS).flatMap((tools) => [...tools]),
  ),
];

/** Tools never published to Telnyx — runtime invokes these internally via continue_workflow. */
export const CALLER_AMY_INTERNAL_ONLY_TOOLS = new Set([
  "resolve_datetime",
  "calendar_availability",
  "check_availability",
  "book_appointment",
  "hold_appointment_slot",
  "release_appointment_hold",
  "find_appointments",
  "reschedule_appointment",
  "cancel_appointment",
  "save_collected_fields",
  "get_workflow_requirements",
  "save_caller_info",
  "save_customer_info",
  "check_customer_fields",
  "check_field_requirements",
  "mark_disposition",
  "create_crm_note",
  "create_crm_task",
  "upsert_crm_contact",
  "update_contact_tags",
  "search_crm_contacts",
  "send_dtmf",
  "create_task",
  "end_call",
  "send_sms",
  "confirm_booking",
  "check_availability",
  // Model-facing tools moved behind runtime_turn
  "record_current_field",
  "continue_workflow",
  "get_runtime_context",
  "lookup_customer",
  "take_structured_message",
  "escalate_human",
  "transfer",
  "hangup",
]);

/** Small stable model-facing surface for Caller Amy on Telnyx. */
export const CALLER_AMY_MODEL_TOOLS = ["runtime_turn"] as const;

/** @deprecated Use CALLER_AMY_MODEL_TOOLS */
export const CALLER_AMY_PUBLISH_EXCLUDED = CALLER_AMY_INTERNAL_ONLY_TOOLS;

/** @deprecated Scheduling tools removed — use continue_workflow */
export const CALLER_AMY_PUBLISH_REQUIRED = [...CALLER_AMY_MODEL_TOOLS] as const;

/** Domain-level aliases — not published to model */
export const DOMAIN_TOOL_ALIASES: Record<string, string> = {
  confirm_booking: "book_appointment",
  check_availability: "calendar_availability",
  get_booking_requirements: "get_workflow_requirements",
};

/**
 * Filter enabled catalog keys for Telnyx publish — runtime-owned orchestration surface.
 * Only CALLER_AMY_MODEL_TOOLS are exposed; scheduling primitives stay internal.
 */
export function filterToolsForCallerAmyPublish(enabledKeys: string[]): string[] {
  const modelSurface = new Set<string>(CALLER_AMY_MODEL_TOOLS);
  const published = new Set<string>();

  for (const key of CALLER_AMY_MODEL_TOOLS) {
    published.add(key);
  }

  // Honor agent config for optional escape hatches only (never internal/scheduling tools).
  for (const key of enabledKeys) {
    if (modelSurface.has(key) && !CALLER_AMY_INTERNAL_ONLY_TOOLS.has(key)) {
      published.add(key);
    }
  }

  return [...published];
}

export function isCallerAmyAgent(agentType?: string | null): boolean {
  return agentType === "receptionist" || agentType === "appointment_booking" || !agentType;
}

export function isInternalOnlyTool(toolType: string): boolean {
  return CALLER_AMY_INTERNAL_ONLY_TOOLS.has(toolType);
}
