/**
 * Short reply after reschedule/cancel flow is COMPLETED — no Luna re-run, no duplicate confirmation.
 */
export function buildArPostCompleteInboundAck(message: string): string {
  const trimmed = (message || "").trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) {
    return "You're all set. See you at your appointment!";
  }
  if (
    /^(thanks|thank you|thank u|thx|ty|ok|okay|k|cool|great|perfect|awesome|sounds good|got it)\b/i.test(
      lower,
    )
  ) {
    return "You're welcome! See you then.";
  }
  if (/\?/.test(trimmed)) {
    return "Your appointment is all set. If you need anything else, the business can help you directly.";
  }
  return "You're all set. See you at your appointment!";
}
