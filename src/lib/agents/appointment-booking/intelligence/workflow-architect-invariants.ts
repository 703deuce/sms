/** Named invariants checked by structural and semantic validators. */
export const WORKFLOW_INVARIANTS = [
  "block_exists",
  "block_allowed_for_appointment_agent",
  "schema_valid",
  "resource_ownership_valid",
  "no_unreachable_node",
  "every_path_ends",
  "required_fields_before_booking",
  "confirmation_before_booking",
  "hold_before_booking",
  "booking_verification_after_creation",
  "sms_after_booking_permitted",
  "fallback_for_calendar_failure",
  "fallback_for_transfer_failure",
  "no_duplicate_action_path",
  "risk_gates_present",
  "tests_assigned",
] as const;

export type WorkflowInvariantId = (typeof WORKFLOW_INVARIANTS)[number];
