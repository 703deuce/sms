/** Task-scoped tool allowlist — defense in depth beyond LiveKit tool visibility. */
const TASK_TOOLS: Record<string, readonly string[]> = {
  DiscoverIntentTask: [
    "submit_caller_information",
    "get_booking_requirements",
    "record_current_field",
    "record_fields",
    "lookup_customer",
    "detect_caller_intent",
    "classify_intent",
    "get_business_answer",
    "take_message",
    "request_human",
    "end_call",
  ],
  CollectRequiredFieldsTask: [
    "submit_caller_information",
    "record_current_field",
    "record_fields",
    "get_booking_requirements",
    "lookup_customer",
    "detect_caller_intent",
    "validate_eligibility",
    "classify_intent",
    "get_business_answer",
    "request_human",
    "end_call",
  ],
  LookupCustomerTask: [
    "lookup_customer",
    "detect_caller_intent",
    "submit_caller_information",
    "record_current_field",
    "record_fields",
    "get_business_answer",
    "request_human",
    "end_call",
  ],
  QualificationTask: ["classify_intent", "submit_caller_information", "record_current_field", "record_fields", "request_human", "take_message", "end_call"],
  ValidateEligibilityTask: ["validate_eligibility", "submit_caller_information", "record_current_field", "record_fields", "take_message", "request_human", "end_call"],
  CheckAvailabilityTask: ["check_availability", "submit_caller_information", "record_current_field", "record_fields", "request_human", "end_call"],
  SelectResourceTask: [
    "select_slot",
    "check_availability",
    "submit_caller_information",
    "request_human",
    "end_call",
  ],
  SelectSlotTask: [
    "select_slot",
    "check_availability",
    "submit_caller_information",
    "request_human",
    "end_call",
  ],
  ConfirmActionTask: [
    "confirm_booking",
    "submit_caller_information",
    "reschedule_appointment",
    "cancel_appointment",
    "request_human",
    "end_call",
  ],
  ConfirmBookingTask: [
    "confirm_booking",
    "submit_caller_information",
    "request_human",
    "end_call",
  ],
  TransferTask: ["request_human", "take_message", "end_call"],
  TakeMessageTask: ["take_message", "end_call"],
  RescheduleTask: [
    "find_appointments",
    "check_availability",
    "select_slot",
    "reschedule_appointment",
    "end_call",
  ],
  CancelTask: ["find_appointments", "cancel_appointment", "end_call"],
  CompleteCallTask: ["end_call", "request_human"],
};

const STATE_TO_TASK: Record<string, string> = {
  INTENT_DISCOVERY: "DiscoverIntentTask",
  COLLECTING_FIELDS: "CollectRequiredFieldsTask",
  CHECKING_AVAILABILITY: "CheckAvailabilityTask",
  SELECTING_SLOT: "SelectResourceTask",
  READY_TO_BOOK: "ConfirmActionTask",
  BOOKING_IN_PROGRESS: "ConfirmActionTask",
  COMPLETE: "CompleteCallTask",
  GENERAL: "DiscoverIntentTask",
};

export function taskForWorkflowState(state: string): string {
  return STATE_TO_TASK[state] || "DiscoverIntentTask";
}

export function workflowStateForTask(taskId: string): string | null {
  const entry = Object.entries(STATE_TO_TASK).find(([, task]) => task === taskId);
  return entry?.[0] || null;
}

export function assertTaskToolAllowed(taskId: string, toolName: string): void {
  const allowed = TASK_TOOLS[taskId];
  if (!allowed?.includes(toolName)) {
    throw new Error(`Tool ${toolName} is not available in task ${taskId}`);
  }
}

export function toolsForTask(taskId: string): readonly string[] {
  return TASK_TOOLS[taskId] || [];
}
