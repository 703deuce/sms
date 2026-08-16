import {
  formatToolFeedbackForModel,
  toolFeedbackRecoverable,
  toolFeedbackSuccess,
  type ToolFeedback,
} from "./index";

/** Lifecycle prefix emitted when a nested collection/intake task owns speech. */
export const TOOL_RESULT_COLLECT_ACTIVE_SILENT =
  "COLLECT_ACTIVE_SILENT: Field collection owns speech. Do not speak — questions are handled by the collection task.";

export const TOOL_RESULT_BOOKING_INTAKE_SILENT =
  "BOOKING_INTAKE_ACTIVE_SILENT: Booking intake owns speech. Do not speak — questions are handled by the intake task.";

function silentTaskFeedback(tool: string, guidance: string): ToolFeedback {
  return toolFeedbackSuccess(guidance, {
    tool,
    runtime_handled_retry: true,
    next_action: "do_not_speak",
    guidance,
  });
}

function parseLifecyclePrefix(raw: string, tool: string): ToolFeedback | null {
  const trimmed = raw.trim();

  if (
    trimmed === TOOL_RESULT_COLLECT_ACTIVE_SILENT ||
    trimmed.startsWith("COLLECT_ACTIVE_SILENT:")
  ) {
    return silentTaskFeedback(
      tool,
      "Field collection task owns speech. Do not speak — the collection task handles questions.",
    );
  }

  if (
    trimmed === TOOL_RESULT_BOOKING_INTAKE_SILENT ||
    trimmed.startsWith("BOOKING_INTAKE_ACTIVE_SILENT:")
  ) {
    return silentTaskFeedback(
      tool,
      "Booking intake owns speech. Do not speak — the intake task handles questions.",
    );
  }

  if (trimmed.startsWith("COLLECTION_PARTIAL:")) {
    return toolFeedbackRecoverable({
      tool,
      recovery_class: "OPERATION_IN_PROGRESS",
      reason: "collection_partial",
      next_action: "do_not_speak",
      runtime_handled_retry: true,
      guidance: trimmed.replace(/^COLLECTION_PARTIAL:\s*/, ""),
    });
  }

  if (trimmed.startsWith("COLLECTION_COMPLETE:")) {
    const body = trimmed.replace(/^COLLECTION_COMPLETE:\s*/, "");
    return toolFeedbackSuccess(body, {
      tool,
      next_action: trimmed.includes("schedule_appointment")
        ? "schedule_appointment_retry"
        : "continue_conversation",
      guidance: body,
    });
  }

  if (trimmed.startsWith("BOOKING_INTAKE_PARTIAL:")) {
    return toolFeedbackRecoverable({
      tool,
      recovery_class: "OPERATION_IN_PROGRESS",
      reason: "intake_partial",
      next_action: "do_not_speak",
      runtime_handled_retry: true,
      guidance: trimmed.replace(/^BOOKING_INTAKE_PARTIAL:\s*/, ""),
    });
  }

  if (trimmed.startsWith("BOOKING_INTAKE_COMPLETE:")) {
    return toolFeedbackSuccess(trimmed.replace(/^BOOKING_INTAKE_COMPLETE:\s*/, ""), {
      tool,
      next_action: "schedule_appointment_retry",
      guidance: trimmed.replace(/^BOOKING_INTAKE_COMPLETE:\s*/, ""),
    });
  }

  if (trimmed.startsWith("already_completed:")) {
    return toolFeedbackSuccess(trimmed.replace(/^already_completed:\s*/, ""), {
      tool,
      recovery_class: "DUPLICATE_OPERATION",
      reason: "already_completed",
      next_action: "end_call",
      caller_already_heard_success: true,
    });
  }

  if (trimmed.endsWith("_SILENT") || trimmed.includes("_SILENT:")) {
    return silentTaskFeedback(tool, trimmed);
  }

  if (trimmed.startsWith("BOOKING_COMPLETE_ALREADY_SPOKEN:")) {
    return toolFeedbackSuccess(trimmed.replace(/^BOOKING_COMPLETE_ALREADY_SPOKEN:\s*/, ""), {
      tool,
      next_action: "end_call",
      caller_already_heard_success: true,
    });
  }

  if (trimmed.startsWith("BOOKING_COMPLETE_SPEAK_NOW:")) {
    return toolFeedbackSuccess(trimmed.replace(/^BOOKING_COMPLETE_SPEAK_NOW:\s*/, ""), {
      tool,
      next_action: "end_call",
    });
  }

  if (trimmed.startsWith("BOOKING_FAILED_ALREADY_SPOKEN:")) {
    return toolFeedbackRecoverable({
      tool,
      recovery_class: "UNKNOWN_FAILURE",
      reason: "booking_failed",
      next_action: "list_slots_then_retry",
      caller_already_heard_failure: true,
      guidance: trimmed.replace(/^BOOKING_FAILED_ALREADY_SPOKEN:\s*/, ""),
    });
  }

  return null;
}

/**
 * Ensure every tool return value is TOOL_FEEDBACK before the LiveKit SDK adds it to chat context.
 * Idempotent when the tool already returned formatToolFeedbackForModel output.
 */
export function normalizeToolResultForModel(tool: string, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return formatToolFeedbackForModel(
      toolFeedbackRecoverable({
        tool,
        recovery_class: "UNKNOWN_FAILURE",
        reason: "empty_tool_result",
        next_action: "take_message",
        guidance: "Tool returned no result. Do not claim success — retry the tool or offer take_message.",
      }),
    );
  }

  if (trimmed.startsWith("TOOL_FEEDBACK:")) {
    return raw;
  }

  const lifecycle = parseLifecyclePrefix(raw, tool);
  if (lifecycle) {
    return formatToolFeedbackForModel(lifecycle);
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("use take_message") ||
    lower.startsWith("use collect_") ||
    lower.startsWith("cannot call") ||
    lower.startsWith("do not call")
  ) {
    return formatToolFeedbackForModel(
      toolFeedbackRecoverable({
        tool,
        recovery_class: "MISSING_INFORMATION",
        reason: "operational_redirect",
        next_action: "continue_conversation",
        guidance: trimmed,
      }),
    );
  }

  return formatToolFeedbackForModel(
    toolFeedbackSuccess(trimmed, {
      tool,
      next_action: "continue_conversation",
      guidance: trimmed,
    }),
  );
}
