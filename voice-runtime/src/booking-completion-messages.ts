/** Deterministic spoken lines for the parent booking tool — not model-generated. */

export const POST_EMAIL_BOOKING_FILLER =
  "One moment — I'm putting that on the calendar now. This can take a few seconds.";

export const POST_CANCEL_FILLER =
  "Okay — give me just a moment while I cancel that appointment on the calendar.";

export function buildBookingSuccessLine(timeLabel: string): string {
  return (
    `You're all set — your appointment is confirmed for ${timeLabel}. ` +
    "A confirmation text is on its way to your phone."
  );
}

/** Tool result after success line was already spoken via speakBookingLine(). */
export const BOOKING_COMPLETE_TOOL_RESULT =
  "BOOKING_COMPLETE_ALREADY_SPOKEN: The confirmation was already spoken to the caller. " +
  "Do not repeat the booking details or give another goodbye. " +
  "If the caller asks for a text confirmation, use send_sms or tell them the confirmation " +
  "text was already sent to their phone. " +
  "If the caller indicates they are done (for example: that's it, no, thanks), call end_call " +
  "immediately with one brief farewell. If they ask a short follow-up, answer in one sentence " +
  "then call end_call.";

/** Spoken when Calendly booking fails — caller hears this from the runtime, not the model. */
export function buildBookingFailureLine(reason?: string): string {
  const detail =
    reason?.trim() ||
    "I'm sorry — that booking didn't go through on our calendar. We can try another time if you'd like.";
  return detail.startsWith("I'm sorry") ? detail : `I'm sorry — ${detail}`;
}

/** Tool result when confirmation audio did not play — agent must speak confirmation. */
export function buildBookingCompleteToolResultFallback(timeLabel: string): string {
  return (
    `BOOKING_COMPLETE_SPEAK_NOW: The appointment IS confirmed for ${timeLabel}. ` +
    "Tell the caller clearly they are all set for that time and a confirmation text was sent. " +
    "Sound certain — the booking succeeded on the calendar. " +
    "Do not say you're still checking or waiting."
  );
}

/** Tool result after failure line was already spoken via speakBookingLine(). */
export const BOOKING_FAILED_TOOL_RESULT =
  "BOOKING_FAILED_ALREADY_SPOKEN: The runtime already told the caller the booking did NOT go through. " +
  "Do NOT say they are booked, confirmed, or that a confirmation text was sent. " +
  "Offer to try schedule_appointment again with list_available_slots, or take a message.";

/** Fast-return when Calendly needs email — model speaks naturally and retries (no runtime error line). */
export function buildBookingNeedsEmailToolResult(slotId: string): string {
  return (
    `BOOKING_NEEDS_EMAIL: This slot (${slotId}) needs an email before Calendly can book it. ` +
    "Do NOT say there was an error, that the calendar failed, or that you are still waiting on confirmation. " +
    "Say naturally that you need their email for the calendar invite — e.g. 'What's the best email for your invite?' " +
    "Repeat it back, get confirmation, call record_booking_email with the confirmed email, " +
    "then call schedule_appointment again with the same slot_id."
  );
}

/** Fast-return when another manifest field is missing before booking. */
export function buildBookingNeedsFieldToolResult(
  slotId: string,
  fieldId: string,
  label: string,
): string {
  return (
    `BOOKING_NEEDS_FIELD: Missing ${label} (${fieldId}) before booking slot ${slotId}. ` +
    "Do NOT say there was a system error or that booking failed. " +
    `Ask the caller naturally for their ${label}. ` +
    "Use collect_caller_fields if needed, then call schedule_appointment again with the same slot_id."
  );
}

/** Recoverable Calendly failure — model collects missing info and retries without error framing. */
export function buildBookingRecoverableToolResult(
  slotId: string,
  detail: string,
  fieldId?: string,
): string {
  if (fieldId === "email") return buildBookingNeedsEmailToolResult(slotId);
  return (
    `BOOKING_NEEDS_RETRY: ${detail} slot_id=${slotId}. ` +
    "Do NOT say there was a system error. Ask for what's missing naturally, " +
    "then call schedule_appointment again with the same slot_id."
  );
}
