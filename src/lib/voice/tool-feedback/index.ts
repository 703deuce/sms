/**
 * Canonical TOOL_FEEDBACK for every Amy tool surface (LiveKit, Telnyx, gateway, integrations).
 */

import { AgentToolError, translateError } from "@/lib/voice/agent-tool-gateway/errors";
import type { AgentToolErrorCode, AgentToolResult } from "@/lib/voice/agent-tool-gateway/types";
import {
  isCalendlyMissingFieldError,
  isCalendlyRateLimitError,
  isCalendlySlotError,
  missingFieldIdFromBookingError,
} from "@/lib/voice/calendly-error-classification";

export type ToolFeedbackOutcome = "success" | "recoverable_failure" | "terminal_failure";

export type RecoveryClass =
  | "MISSING_INFORMATION"
  | "INVALID_INFORMATION"
  | "RESOURCE_UNAVAILABLE"
  | "TEMPORARY_PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "TRANSFER_BUSY"
  | "TRANSFER_NO_ANSWER"
  | "PERMISSION_ERROR"
  | "AUTH_ERROR"
  | "DUPLICATE_OPERATION"
  | "OPERATION_IN_PROGRESS"
  | "UNKNOWN_FAILURE";

export type ToolNextAction =
  | "collect_email_then_retry"
  | "collect_field_then_retry"
  | "collect_booking_requirements"
  | "record_field_then_retry"
  | "retry_same_tool"
  | "list_slots_then_retry"
  | "schedule_appointment_retry"
  | "take_message"
  | "check_booking_status"
  | "end_call"
  | "none";

export type ToolFeedback = {
  outcome: ToolFeedbackOutcome;
  tool?: string;
  recovery_class?: RecoveryClass;
  reason?: string;
  field_id?: string;
  field_label?: string;
  next_action: ToolNextAction;
  retry_after_ms?: number;
  runtime_handled_retry?: boolean;
  context?: Record<string, unknown>;
  guidance: string;
  caller_already_heard_failure?: boolean;
  caller_already_heard_success?: boolean;
};

export function toolFeedbackSuccess(
  guidance: string,
  extra?: Partial<ToolFeedback>,
): ToolFeedback {
  return {
    outcome: "success",
    next_action: "none",
    guidance,
    ...extra,
  };
}

export function toolFeedbackRecoverable(
  input: Omit<ToolFeedback, "outcome"> & { guidance: string },
): ToolFeedback {
  return { outcome: "recoverable_failure", ...input };
}

export function toolFeedbackTerminal(
  input: Omit<ToolFeedback, "outcome"> & { guidance: string },
): ToolFeedback {
  return { outcome: "terminal_failure", ...input };
}

export function formatToolFeedbackForModel(feedback: ToolFeedback): string {
  const parts: string[] = [`TOOL_FEEDBACK: ${feedback.outcome}`];
  if (feedback.tool) parts.push(`tool: ${feedback.tool}`);
  if (feedback.recovery_class) parts.push(`recovery_class: ${feedback.recovery_class}`);
  if (feedback.reason) parts.push(`reason: ${feedback.reason}`);
  if (feedback.field_id) parts.push(`field_id: ${feedback.field_id}`);
  if (feedback.field_label) parts.push(`field_label: ${feedback.field_label}`);
  parts.push(`next_action: ${feedback.next_action}`);
  if (feedback.retry_after_ms != null) {
    parts.push(`retry_after_ms: ${feedback.retry_after_ms}`);
  }
  if (feedback.runtime_handled_retry) {
    parts.push("runtime_handled_retry: true");
  }
  if (feedback.caller_already_heard_failure) {
    parts.push("caller_already_heard_failure: true");
  }
  if (feedback.caller_already_heard_success) {
    parts.push("caller_already_heard_success: true");
  }
  if (feedback.context && Object.keys(feedback.context).length > 0) {
    parts.push(`context: ${JSON.stringify(feedback.context)}`);
  }
  parts.push(`guidance: ${feedback.guidance}`);
  return parts.join("\n");
}

function recoveryClassFromGatewayCode(code: AgentToolErrorCode): RecoveryClass {
  switch (code) {
    case "MISSING_REQUIRED_FIELD":
      return "MISSING_INFORMATION";
    case "INVALID_INPUT":
    case "SLOT_NOT_IN_AVAILABILITY":
      return "INVALID_INFORMATION";
    case "SLOT_UNAVAILABLE":
      return "RESOURCE_UNAVAILABLE";
    case "AUTH_REQUIRED":
      return "AUTH_ERROR";
    case "POLICY_BLOCKED":
      return "PERMISSION_ERROR";
    case "ALREADY_COMPLETED":
      return "DUPLICATE_OPERATION";
    case "TEMPORARY_PROVIDER_ERROR":
      return "TEMPORARY_PROVIDER_ERROR";
    case "CUSTOMER_NOT_FOUND":
      return "RESOURCE_UNAVAILABLE";
    default:
      return "UNKNOWN_FAILURE";
  }
}

function nextActionFromGatewayCode(code: AgentToolErrorCode, toolName?: string): ToolNextAction {
  switch (code) {
    case "MISSING_REQUIRED_FIELD":
      return "collect_field_then_retry";
    case "INVALID_INPUT":
    case "SLOT_NOT_IN_AVAILABILITY":
      return toolName === "schedule_appointment" ? "list_slots_then_retry" : "collect_field_then_retry";
    case "SLOT_UNAVAILABLE":
      return "list_slots_then_retry";
    case "ALREADY_COMPLETED":
      return "none";
    case "TEMPORARY_PROVIDER_ERROR":
      return "retry_same_tool";
    case "AUTH_REQUIRED":
    case "POLICY_BLOCKED":
      return "take_message";
    default:
      return "take_message";
  }
}

export function toolFeedbackFromError(
  err: unknown,
  input: {
    tool: string;
    runtimeHandledRetry?: boolean;
    context?: Record<string, unknown>;
    callerAlreadyHeardFailure?: boolean;
  },
): ToolFeedback {
  const translated: AgentToolError = translateError(err);
  const recoveryClass = recoveryClassFromGatewayCode(translated.code);
  const isRateLimited = isCalendlyRateLimitError(err);
  const effectiveClass: RecoveryClass = isRateLimited ? "RATE_LIMITED" : recoveryClass;

  if (translated.code === "ALREADY_COMPLETED") {
    return toolFeedbackSuccess(
      translated.userMessage || "Operation already completed — tell the caller they're all set.",
      {
        tool: input.tool,
        recovery_class: "DUPLICATE_OPERATION",
        reason: "already_completed",
        context: input.context,
        caller_already_heard_success: true,
      },
    );
  }

  const recoverable =
    translated.retryable ||
    effectiveClass === "MISSING_INFORMATION" ||
    effectiveClass === "INVALID_INFORMATION" ||
    effectiveClass === "RESOURCE_UNAVAILABLE" ||
    effectiveClass === "RATE_LIMITED" ||
    effectiveClass === "TEMPORARY_PROVIDER_ERROR";

  const nextAction = nextActionFromGatewayCode(translated.code, input.tool);
  const guidance =
    translated.userMessage ||
    (recoverable
      ? "Handle this naturally without saying there was a system error."
      : "Offer take_message or another path the caller can accept.");

  const base = {
    tool: input.tool,
    recovery_class: effectiveClass,
    reason: translated.code.toLowerCase(),
    next_action: nextAction,
    runtime_handled_retry: input.runtimeHandledRetry ?? translated.retryable,
    context: input.context,
    guidance,
    caller_already_heard_failure: input.callerAlreadyHeardFailure,
  };

  return recoverable ? toolFeedbackRecoverable(base) : toolFeedbackTerminal(base);
}

export function toolFeedbackFromGatewayResult(
  result: AgentToolResult | Record<string, unknown>,
  tool: string,
): ToolFeedback {
  const row = result as AgentToolResult & Record<string, unknown>;
  const ok = row.ok !== false && row.success !== false && !row.error;
  if (ok) {
    const guidance = String(
      row.speak || row.user_message || row.message || "Operation completed.",
    );
    return toolFeedbackSuccess(guidance, {
      tool,
      context: typeof row.data === "object" && row.data ? (row.data as Record<string, unknown>) : undefined,
    });
  }

  const code = (row.error_code as AgentToolErrorCode | null) || "INTERNAL_ERROR";
  const message = String(row.error || row.message || row.speak || row.user_message || "Tool failed");
  const ate = new AgentToolError(
    code,
    message,
    Boolean(row.retryable),
    String(row.speak || row.user_message || message),
    typeof row.data === "object" && row.data ? (row.data as Record<string, unknown>) : {},
  );
  return toolFeedbackFromError(ate, {
    tool,
    runtimeHandledRetry: Boolean(row.retryable),
    context: typeof row.data === "object" && row.data ? (row.data as Record<string, unknown>) : undefined,
  });
}

export function formatGatewayResultForModel(
  result: AgentToolResult | Record<string, unknown>,
  tool: string,
): string {
  return formatToolFeedbackForModel(toolFeedbackFromGatewayResult(result, tool));
}

/** Domain action results (Telnyx workflow, Zoho hooks, etc.). */
export function toolFeedbackFromDomainResult(
  result: {
    ok?: boolean;
    speak?: string;
    error_code?: string | null;
    data?: Record<string, unknown>;
  },
  tool: string,
): ToolFeedback {
  if (result.ok) {
    return toolFeedbackSuccess(result.speak || "Done.", {
      tool,
      context: result.data,
    });
  }
  const err = new AgentToolError(
    (result.error_code as AgentToolErrorCode) || "INTERNAL_ERROR",
    result.speak || "Action failed",
    false,
    result.speak,
    result.data || {},
  );
  return toolFeedbackFromError(err, { tool, context: result.data });
}

export function formatDomainResultForModel(
  result: { ok?: boolean; speak?: string; error_code?: string | null; data?: Record<string, unknown> },
  tool: string,
): string {
  return formatToolFeedbackForModel(toolFeedbackFromDomainResult(result, tool));
}

export function toolFeedbackMissingEmail(input: { tool: string; slotId: string }): ToolFeedback {
  return toolFeedbackRecoverable({
    tool: input.tool,
    recovery_class: "MISSING_INFORMATION",
    reason: "missing_email",
    field_id: "email",
    field_label: "email address",
    next_action: "collect_email_then_retry",
    context: { slot_id: input.slotId },
    guidance:
      "An email is required before this can be booked. Do NOT say there was an error. " +
      "Ask naturally for their email, confirm it, use record_booking_email, then retry the booking tool.",
  });
}

export function toolFeedbackMissingField(input: {
  tool: string;
  slotId: string;
  fieldId: string;
  fieldLabel: string;
  hint?: string;
}): ToolFeedback {
  const isEmail = input.fieldId === "email";
  return toolFeedbackRecoverable({
    tool: input.tool,
    recovery_class: "MISSING_INFORMATION",
    reason: `missing_${input.fieldId}`,
    field_id: input.fieldId,
    field_label: input.fieldLabel,
    next_action: isEmail ? "collect_email_then_retry" : "collect_field_then_retry",
    context: { slot_id: input.slotId },
    guidance:
      input.hint ||
      `Missing ${input.fieldLabel} before booking. Ask naturally — do not mention a system error.`,
  });
}

export function toolFeedbackInvalidEmail(email: string): ToolFeedback {
  return toolFeedbackRecoverable({
    tool: "record_booking_email",
    recovery_class: "INVALID_INFORMATION",
    reason: "invalid_email",
    field_id: "email",
    field_label: "email address",
    next_action: "collect_email_then_retry",
    context: { rejected_value: email },
    guidance:
      "Email didn't look right. Ask them to say it again slowly — do not say 'invalid email'.",
  });
}

export function toolFeedbackBookingInProgress(toolName: string): ToolFeedback {
  return toolFeedbackRecoverable({
    tool: toolName,
    recovery_class: "OPERATION_IN_PROGRESS",
    reason: "booking_in_progress",
    next_action: "none",
    guidance:
      "Calendar write is already in progress. Tell the caller you're finishing the booking. " +
      "Do NOT call schedule_appointment, record_booking_email, or record email again until it completes.",
  });
}

export function toolFeedbackBookingConfirmedAnswer(when: string): ToolFeedback {
  return toolFeedbackSuccess(
    `Appointment IS confirmed for ${when}. Tell the caller directly they are all set — ` +
      "do NOT say you are checking or call check_booking_status.",
    {
      tool: "check_booking_status",
      caller_already_heard_success: true,
      next_action: "end_call",
      context: { booked_time_label: when },
    },
  );
}

export function toolFeedbackInvalidSlot(toolName: string, slotId: string): ToolFeedback {
  return toolFeedbackRecoverable({
    tool: toolName,
    recovery_class: "INVALID_INFORMATION",
    reason: "slot_not_found",
    next_action: "list_slots_then_retry",
    context: { slot_id: slotId },
    guidance: `Slot ${slotId} is stale — call list_available_slots and pick a fresh slot_id.`,
  });
}

export function toolFeedbackBookingCompleteSpoken(): ToolFeedback {
  return toolFeedbackSuccess(
    "BOOKING_COMPLETE_ALREADY_SPOKEN: Appointment IS confirmed on the calendar. " +
      "Confirmation was already spoken to the caller and a text was sent. " +
      "If they ask whether they are booked, say yes confidently — do NOT say you are still waiting or checking. " +
      "Do not repeat booking details. Call end_call if the caller is done.",
    { tool: "schedule_appointment", caller_already_heard_success: true, next_action: "end_call" },
  );
}

export function toolFeedbackBookingCompleteSpeakNow(timeLabel: string): ToolFeedback {
  return toolFeedbackSuccess(
    `Appointment IS confirmed for ${timeLabel}. Tell the caller clearly they are all set. ` +
      "Do NOT call check_booking_status — booking already succeeded.",
    {
      tool: "schedule_appointment",
      context: { booked_time_label: timeLabel },
      next_action: "end_call",
    },
  );
}

export function toolFeedbackTransferFailure(input: {
  reason: string;
  takeMessage: boolean;
  recoveryClass: RecoveryClass;
}): ToolFeedback {
  const recoverable =
    input.recoveryClass === "TRANSFER_BUSY" ||
    input.recoveryClass === "TRANSFER_NO_ANSWER" ||
    input.recoveryClass === "TEMPORARY_PROVIDER_ERROR";
  const nextAction: ToolNextAction = input.takeMessage ? "take_message" : "none";
  const guidance = input.takeMessage
    ? "Transfer didn't connect — offer to take a message naturally."
    : "Transfer failed. Apologize briefly and ask if there's anything else.";

  const base = {
    tool: "transfer_to_human",
    recovery_class: input.recoveryClass,
    reason: input.reason,
    next_action: nextAction,
    runtime_handled_retry: true,
    guidance,
    caller_already_heard_failure: true,
  };

  return recoverable ? toolFeedbackRecoverable(base) : toolFeedbackTerminal(base);
}

export function toolFeedbackMissingCallerField(input: {
  tool: string;
  fieldId: string;
  fieldLabel: string;
  hint?: string;
}): ToolFeedback {
  return toolFeedbackRecoverable({
    tool: input.tool,
    recovery_class: "MISSING_INFORMATION",
    reason: `missing_${input.fieldId}`,
    field_id: input.fieldId,
    field_label: input.fieldLabel,
    next_action: "collect_field_then_retry",
    guidance:
      input.hint || `Ask for their ${input.fieldLabel} only — do not mention errors.`,
  });
}

export function toolFeedbackFromBookingWriteError(
  err: unknown,
  input: { tool: string; slotId: string; callerAlreadyHeardFailure?: boolean },
): ToolFeedback {
  if (isCalendlyMissingFieldError(err)) {
    const fieldId = missingFieldIdFromBookingError(err);
    if (fieldId === "email") {
      return toolFeedbackMissingEmail({ tool: input.tool, slotId: input.slotId });
    }
    if (fieldId) {
      return toolFeedbackMissingField({
        tool: input.tool,
        slotId: input.slotId,
        fieldId,
        fieldLabel: fieldId.replace(/_/g, " "),
      });
    }
  }

  if (isCalendlySlotError(err)) {
    return toolFeedbackRecoverable({
      tool: input.tool,
      recovery_class: "RESOURCE_UNAVAILABLE",
      reason: "slot_unavailable",
      next_action: "list_slots_then_retry",
      runtime_handled_retry: true,
      context: { slot_id: input.slotId },
      caller_already_heard_failure: input.callerAlreadyHeardFailure,
      guidance:
        "That time isn't available. Offer list_available_slots — do NOT say they are confirmed.",
    });
  }

  return toolFeedbackFromError(err, {
    tool: input.tool,
    runtimeHandledRetry: true,
    context: { slot_id: input.slotId },
    callerAlreadyHeardFailure: input.callerAlreadyHeardFailure,
  });
}

export {
  normalizeToolResultForModel,
  TOOL_RESULT_COLLECT_ACTIVE_SILENT,
  TOOL_RESULT_BOOKING_INTAKE_SILENT,
} from "./normalize";
