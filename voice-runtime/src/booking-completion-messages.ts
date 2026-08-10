/** Deterministic spoken lines for the parent booking tool — not model-generated. */

export const POST_EMAIL_BOOKING_FILLER =
  "Perfect — one moment while I put that on the calendar for you.";

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
