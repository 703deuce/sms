import type { ToolNextAction } from "./index";

/** Model-facing definitions — injected in system prompt and echoed on each TOOL_FEEDBACK. */
export const TOOL_NEXT_ACTION_DEFINITIONS: Record<ToolNextAction, string> = {
  continue_conversation:
    "Respond to the caller with one brief thought. Ask at most one question if you still need something. Do not call another tool unless guidance says to.",
  do_not_speak:
    "Do not say anything to the caller. A nested collection or intake task is already asking the next question. Wait silently for the tool to finish.",
  offer_slots_and_confirm:
    "Read the slot times from guidance or context. Offer up to two or three options in plain speech. Ask exactly one question: which time works? When they pick, call schedule_appointment with that slot_id.",
  list_slots_then_retry:
    "Call list_available_slots (or calendar_availability on Telnyx). When slots return, offer a few times — one question only — then book or reschedule with the chosen slot.",
  schedule_appointment_retry:
    "All requirements for booking are satisfied. Call schedule_appointment immediately with the slot_id from guidance or context. Use the same slot_id if a retry.",
  collect_email_then_retry:
    "Ask for email in one natural question. Confirm it, save with record_booking_email or record_receptionist_field (field_id email), then retry the booking tool with the same slot_id.",
  collect_field_then_retry:
    "Ask for the missing field in one question only. Save with record_receptionist_field, then retry the same tool that failed.",
  collect_booking_requirements:
    "Call collect_booking_requirements to run booking intake for all missing profile fields. Do not use collect_caller_fields for booking.",
  record_field_then_retry:
    "Persist the value with record_receptionist_field or record_current_field, then retry the tool that reported the missing field.",
  retry_same_tool:
    "A brief provider glitch occurred. Retry the same tool once. If it fails again, follow guidance or offer take_message.",
  check_booking_status:
    "Tell the caller you are finishing the booking or checking status. Call check_booking_status. Do not claim success until it confirms or schedule_appointment already succeeded.",
  take_message:
    "Offer to take a message or callback. Use take_message — not collect_caller_fields. One brief offer; do not stack questions.",
  end_call:
    "The caller's request is complete (booked, transferred, or done). Give one warm farewell, then call end_call. Do not keep chatting.",
  none:
    "Deprecated — follow guidance text on this TOOL_FEEDBACK instead.",
};

export function describeNextAction(action: ToolNextAction): string {
  return TOOL_NEXT_ACTION_DEFINITIONS[action] ?? TOOL_NEXT_ACTION_DEFINITIONS.continue_conversation;
}

/**
 * Static block for compiled receptionist / frontdesk prompts.
 * Gives the model the full next_action vocabulary before any tool runs.
 */
export function buildToolFeedbackVocabularyForPrompt(): string {
  const lines = [
    "TOOL_FEEDBACK / NEXT_ACTION VOCABULARY",
    "Every tool result includes TOOL_FEEDBACK with outcome, next_action, next_action_meaning, and guidance.",
    "Always follow next_action_meaning and guidance together. Trust TOOL_FEEDBACK over your assumptions.",
    "",
    "next_action definitions (when you see this token, do exactly this):",
  ];

  const ordered: ToolNextAction[] = [
    "continue_conversation",
    "do_not_speak",
    "offer_slots_and_confirm",
    "list_slots_then_retry",
    "schedule_appointment_retry",
    "collect_email_then_retry",
    "collect_field_then_retry",
    "collect_booking_requirements",
    "record_field_then_retry",
    "retry_same_tool",
    "check_booking_status",
    "take_message",
    "end_call",
  ];

  for (const key of ordered) {
    lines.push(`- ${key}: ${TOOL_NEXT_ACTION_DEFINITIONS[key]}`);
  }

  lines.push(
    "",
    "Outcomes:",
    "- success: the tool step worked — follow next_action to continue the call.",
    "- recoverable_failure: something is missing or blocked — follow next_action to fix it naturally (never say 'system error').",
    "- terminal_failure: this path cannot complete — follow next_action (usually take_message or end_call).",
  );

  return lines.join("\n");
}
