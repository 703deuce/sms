/**
 * Transovo task boundary — mirrors LiveKit AgentTask contract without requiring
 * the Python beta workflow APIs. Replace with native LiveKit TS primitives when available.
 */
export type AmyActiveTask =
  | "reception"
  | "book_appointment"
  | "modify_appointment"
  | "take_message"
  | "transfer"
  | "complete";

export type AmyTaskResult<T = unknown> = {
  task: AmyActiveTask;
  ok: boolean;
  data?: T;
  speak?: string;
};

/** Focused conversational objective for the active task (not internal graph nodes). */
export function activeTaskForContext(input: {
  callerIntent?: string | null;
  currentNodeId?: string | null;
  bookingReceiptPresent?: boolean;
}): AmyActiveTask {
  const intent = input.callerIntent;
  const node = input.currentNodeId || "";

  if (input.bookingReceiptPresent || node === "complete") return "complete";
  if (intent === "emergency" || node === "emergency_handoff" || node === "transfer_fallback") {
    return "transfer";
  }
  if (intent === "reschedule" || intent === "cancel" || node.startsWith("cancel_") || node === "reschedule_lookup") {
    return "modify_appointment";
  }
  if (
    node === "check_availability" ||
    node === "select_slot" ||
    node === "confirm_booking" ||
    node === "classify" ||
    node === "validate_eligibility" ||
    (node === "collect_fields" && intent !== "general_question")
  ) {
    return "book_appointment";
  }
  if (node === "collect_fields" || node === "detect_intent" || node === "lookup_customer") {
    return "reception";
  }
  return "reception";
}
