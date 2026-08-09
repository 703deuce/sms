import {
  BaseWorkflowTask,
  registerWorkflowTask,
  taskTypeForSession,
} from "./types";

class CollectRequiredFieldsTask extends BaseWorkflowTask {
  readonly taskType = "CollectRequiredFieldsTask";
  readonly description =
    "Collect required workflow fields. Accept multiple values per utterance via record_fields when appropriate.";

  protected workflowStateForTask() {
    return "COLLECTING_FIELDS" as const;
  }

  buildInstructions() {
    return [
      "CollectRequiredFieldsTask:",
      "- Ask for the active field naturally.",
      "- When the caller provides one or more values, use record_current_field or record_fields.",
      "- Do not check availability until every required field is collected.",
    ].join("\n");
  }

  allowedTools() {
    return [
      "get_booking_requirements",
      "record_current_field",
      "record_fields",
      "lookup_customer",
      "detect_caller_intent",
      "validate_eligibility",
      "classify_intent",
      "get_business_answer",
      "request_human",
      "end_call",
    ];
  }
}

class LookupCustomerTask extends BaseWorkflowTask {
  readonly taskType = "LookupCustomerTask";
  readonly description = "Identify caller using phone, email, or name.";

  protected workflowStateForTask() {
    return "INTENT_DISCOVERY" as const;
  }

  buildInstructions() {
    return "LookupCustomerTask: Use lookup_customer when identity is unclear. Do not assume ANI match is the speaker.";
  }

  allowedTools() {
    return [
      "lookup_customer",
      "detect_caller_intent",
      "get_business_answer",
      "record_current_field",
      "request_human",
      "end_call",
    ];
  }
}

class QualificationTask extends BaseWorkflowTask {
  readonly taskType = "QualificationTask";
  readonly description = "Classify urgency and route per configured rules.";

  protected workflowStateForTask() {
    return "COLLECTING_FIELDS" as const;
  }

  buildInstructions() {
    return "QualificationTask: Use classify_intent after safety-relevant details. Follow configured emergency paths.";
  }

  allowedTools() {
    return ["classify_intent", "record_current_field", "request_human", "take_message", "end_call"];
  }
}

class ValidateEligibilityTask extends BaseWorkflowTask {
  readonly taskType = "ValidateEligibilityTask";
  readonly description = "Validate service area and eligibility.";

  protected workflowStateForTask() {
    return "COLLECTING_FIELDS" as const;
  }

  buildInstructions() {
    return "ValidateEligibilityTask: Call validate_eligibility once service address is known.";
  }

  allowedTools() {
    return ["validate_eligibility", "record_current_field", "take_message", "request_human", "end_call"];
  }
}

class CheckAvailabilityTask extends BaseWorkflowTask {
  readonly taskType = "CheckAvailabilityTask";
  readonly description = "Check real multi-resource availability.";

  protected workflowStateForTask() {
    return "CHECKING_AVAILABILITY" as const;
  }

  buildInstructions() {
    return "CheckAvailabilityTask: Call check_availability before offering times. Never invent slots.";
  }

  allowedTools() {
    return ["check_availability", "record_current_field", "request_human", "end_call"];
  }
}

class SelectResourceTask extends BaseWorkflowTask {
  readonly taskType = "SelectResourceTask";
  readonly description = "Select a slot from returned availability.";

  protected workflowStateForTask() {
    return "SELECTING_SLOT" as const;
  }

  buildInstructions() {
    return "SelectResourceTask: Offer times naturally without naming technicians. Call select_slot when caller chooses.";
  }

  allowedTools() {
    return ["select_slot", "check_availability", "request_human", "end_call"];
  }
}

class ConfirmActionTask extends BaseWorkflowTask {
  readonly taskType = "ConfirmActionTask";
  readonly description = "Explicit confirmation before external writes.";

  protected workflowStateForTask() {
    return "READY_TO_BOOK" as const;
  }

  buildInstructions() {
    return "ConfirmActionTask: Read back details, get explicit yes, then confirm_booking({ confirmed: true }).";
  }

  allowedTools() {
    return ["confirm_booking", "reschedule_appointment", "cancel_appointment", "request_human", "end_call"];
  }
}

class TransferTask extends BaseWorkflowTask {
  readonly taskType = "TransferTask";
  readonly description = "Warm transfer with recovery on failure.";

  protected workflowStateForTask() {
    return "GENERAL" as const;
  }

  buildInstructions() {
    return "TransferTask: Use request_human for configured destinations. If transfer fails, continue with fallback.";
  }

  allowedTools() {
    return ["request_human", "take_message", "end_call"];
  }
}

class TakeMessageTask extends BaseWorkflowTask {
  readonly taskType = "TakeMessageTask";
  readonly description = "Save caller message for staff follow-up.";

  protected workflowStateForTask() {
    return "GENERAL" as const;
  }

  allowedTools() {
    return ["take_message", "end_call"];
  }
}

class RescheduleTask extends BaseWorkflowTask {
  readonly taskType = "RescheduleTask";
  readonly description = "Locate and reschedule existing appointment.";

  protected workflowStateForTask() {
    return "GENERAL" as const;
  }

  allowedTools() {
    return ["find_appointments", "check_availability", "select_slot", "reschedule_appointment", "end_call"];
  }
}

class CancelTask extends BaseWorkflowTask {
  readonly taskType = "CancelTask";
  readonly description = "Cancel existing appointment.";

  protected workflowStateForTask() {
    return "GENERAL" as const;
  }

  allowedTools() {
    return ["find_appointments", "cancel_appointment", "end_call"];
  }
}

class CompleteCallTask extends BaseWorkflowTask {
  readonly taskType = "CompleteCallTask";
  readonly description = "Wrap up completed workflow.";

  protected workflowStateForTask() {
    return "COMPLETE" as const;
  }

  allowedTools() {
    return ["end_call", "request_human"];
  }
}

registerWorkflowTask(new CollectRequiredFieldsTask());
registerWorkflowTask(new LookupCustomerTask());
registerWorkflowTask(new QualificationTask());
registerWorkflowTask(new ValidateEligibilityTask());
registerWorkflowTask(new CheckAvailabilityTask());
registerWorkflowTask(new SelectResourceTask());
registerWorkflowTask(new ConfirmActionTask());
registerWorkflowTask(new TransferTask());
registerWorkflowTask(new TakeMessageTask());
registerWorkflowTask(new RescheduleTask());
registerWorkflowTask(new CancelTask());
registerWorkflowTask(new CompleteCallTask());

export { taskTypeForSession, resolveActiveTask } from "./types";
