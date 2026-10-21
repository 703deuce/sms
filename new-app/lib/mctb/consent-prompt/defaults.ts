export function defaultMctbConsentScript(businessName = "our business"): string {
  const name = businessName.trim() || "our business";
  return `Hi, you've reached ${name}. Sorry we couldn't get to the phone. If you'd like us to text you back so we can help, press 1 now. Message and data rates may apply.`;
}

/** Spoken when caller does not press 1 or presses 2 — then voicemail continues. */
export const MCTB_PRESS1_FALLBACK_DISCLOSURE =
  "Sorry we missed your call. To receive a text message from us, press 1. To continue without a text, press 2 or hang up.";
