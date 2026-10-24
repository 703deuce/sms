/** Lightweight booking/scheduling intent for SEND_LINK caller-turn routing (not semantic LLM). */
const BOOKING_INTENT_RE =
  /\b(book|booking|schedule|appointment|reserv(e|ation)|link|text me|send me)\b/i;

export function transcriptSignalsBookingIntent(transcript: string): boolean {
  const text = transcript.trim();
  if (text.length < 3) return false;
  return BOOKING_INTENT_RE.test(text);
}
