import { STATE_ALLOWED_TOOLS } from "./states";

/** Union of all tools Amy may ever need during a booking call. */
export const CALLER_AMY_WORKFLOW_TOOL_UNION: readonly string[] = [
  ...new Set(
    Object.values(STATE_ALLOWED_TOOLS).flatMap((tools) => [...tools]),
  ),
];

/** Tools excluded from Caller Amy publish — use field-runtime instead. */
export const CALLER_AMY_PUBLISH_EXCLUDED = new Set([
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
]);

/** Domain-level aliases exposed to the model (map to canonical builtins). */
export const DOMAIN_TOOL_ALIASES: Record<string, string> = {
  confirm_booking: "book_appointment",
  check_availability: "calendar_availability",
  get_booking_requirements: "get_workflow_requirements",
};

/** Core workflow runtime tools always included on Caller Amy Telnyx publish. */
export const CALLER_AMY_PUBLISH_REQUIRED = [
  "record_current_field",
  "save_collected_fields",
  "get_workflow_requirements",
  "get_runtime_context",
  "resolve_datetime",
  "calendar_availability",
  "book_appointment",
  "hold_appointment_slot",
  "release_appointment_hold",
] as const;

/**
 * Filter enabled catalog keys for Telnyx publish — workflow-scoped tool surface.
 * Merges required runtime tools so legacy configs (save_caller_info only) still publish correctly.
 */
export function filterToolsForCallerAmyPublish(enabledKeys: string[]): string[] {
  const allowed = new Set(CALLER_AMY_WORKFLOW_TOOL_UNION);
  for (const alias of Object.keys(DOMAIN_TOOL_ALIASES)) {
    allowed.add(alias);
  }
  const filtered = enabledKeys.filter(
    (k) => allowed.has(k) && !CALLER_AMY_PUBLISH_EXCLUDED.has(k),
  );
  const merged = new Set(filtered);
  for (const key of CALLER_AMY_PUBLISH_REQUIRED) {
    if (allowed.has(key)) merged.add(key);
  }
  return [...merged];
}

export function isCallerAmyAgent(agentType?: string | null): boolean {
  return agentType === "receptionist" || agentType === "appointment_booking" || !agentType;
}
