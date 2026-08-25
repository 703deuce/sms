/**
 * Test-plan generator for workflow draft changes.
 */

const PATTERN_TESTS: Array<{ pattern: RegExp; tests: string[] }> = [
  {
    pattern: /after[- ]hours|closed|night/i,
    tests: ["after_hours_inbound", "transfer_fallback", "business_hours_branch"],
  },
  {
    pattern: /emergency|sewer|urgent|on[- ]call/i,
    tests: ["emergency_branch", "transfer_no_answer_fallback", "staff_notification"],
  },
  {
    pattern: /transfer/i,
    tests: ["transfer_success", "transfer_no_answer", "transfer_busy_fallback"],
  },
  {
    pattern: /don'?t book|didn'?t book|failed booking|without an appointment|booking link|follow[- ]up|ten minutes|text.*link/i,
    tests: [
      "caller_books_successfully_no_followup",
      "caller_declines_slots_followup_scheduled",
      "caller_hangup_before_booking",
      "customer_opted_out_sms_blocked",
      "quiet_hours_sms_deferred",
      "booked_during_delay_followup_canceled",
      "duplicate_call_event_single_message",
      "sms_failure_recorded_no_duplicate_retry",
    ],
  },
  {
    pattern: /drain|symptom|required field|collect/i,
    tests: [
      "service_specific_field_collected",
      "required_field_gate_before_booking",
      "field_saved_to_contact_and_appointment",
    ],
  },
  {
    pattern: /three (slot|choice|option)|afternoon/i,
    tests: [
      "three_slots_offered_when_available",
      "fewer_than_three_slots_available",
      "afternoon_priority_when_configured",
    ],
  },
  {
    pattern: /callback|7\s*am|call back/i,
    tests: ["callback_task_scheduled", "callback_assignee_resolved"],
  },
];

const BASE_TESTS = [
  "workflow_validation",
  "caller_confirmation_before_booking",
  "calendar_failure_safe_fallback",
  "idempotent_booking_retry",
];

export function generateWorkflowTestPlan(input: {
  userRequest: string;
  nodeTypes: string[];
  addedNodeIds?: string[];
}): string[] {
  const tests = new Set<string>(BASE_TESTS);
  const hay = `${input.userRequest} ${input.nodeTypes.join(" ")}`;

  for (const rule of PATTERN_TESTS) {
    if (rule.pattern.test(hay)) {
      for (const t of rule.tests) tests.add(t);
    }
  }

  if (input.nodeTypes.includes("send_booking_link") || input.nodeTypes.includes("delay")) {
    tests.add("messaging_policy_gate_before_sms");
  }
  if (input.nodeTypes.includes("create_callback_task")) {
    tests.add("callback_task_created_at_scheduled_time");
  }
  if (input.nodeTypes.includes("transfer_call")) {
    tests.add("transfer_destination_resolved");
  }

  return [...tests];
}
