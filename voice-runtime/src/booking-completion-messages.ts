/** Deterministic spoken lines for the parent booking tool — not model-generated. */

export const POST_EMAIL_BOOKING_FILLER =
  "Perfect — one moment while I put that on the calendar for you. This can take a few seconds.";

export const POST_CANCEL_FILLER =
  "Okay — give me just a moment while I cancel that appointment on the calendar.";

export function buildBookingSuccessLine(timeLabel: string): string {
  return (
    `You're all set — your appointment is confirmed for ${timeLabel}. ` +
    "A confirmation text is on its way to your phone."
  );
}

/** Tool result after success line was already spoken via ctx.update(). */
export const BOOKING_COMPLETE_TOOL_RESULT =
  "BOOKING_COMPLETE_ALREADY_SPOKEN: The confirmation was already spoken to the caller. " +
  "Do not repeat the booking details or give another goodbye. " +
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

/** Tool result after failure line was already spoken via ctx.update(). */
export const BOOKING_FAILED_TOOL_RESULT =
  "BOOKING_FAILED_ALREADY_SPOKEN: The runtime already told the caller the booking did NOT go through. " +
  "Do NOT say they are booked, confirmed, or that a confirmation text was sent. " +
  "Offer to try schedule_appointment again with list_available_slots, or take a message.";
