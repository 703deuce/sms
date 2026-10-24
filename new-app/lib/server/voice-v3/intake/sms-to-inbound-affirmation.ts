/** Caller affirms texting the booking link to the number they are calling from. */
const AFFIRM_INBOUND_SMS_RE =
  /\b(this number|that number|this one|the number i(?:'m| am) calling from|same number|yes|yeah|yep|sure|correct|that's fine|sounds good|please do|go ahead)\b/i;

export function callerAffirmsBookingLinkToInboundNumber(utterance: string): boolean {
  const text = utterance.trim();
  if (text.length < 2) return false;
  return AFFIRM_INBOUND_SMS_RE.test(text);
}
