/** Detect Twilio Messaging Service SIDs so we never treat them as Telnyx profile IDs. */
export function looksLikeTwilioMessagingServiceSid(sid: string | null | undefined): boolean {
  return Boolean(sid && /^MG[0-9a-f]{32}$/i.test(sid));
}

export function looksLikeTwilioPhoneSid(sid: string | null | undefined): boolean {
  return Boolean(sid && /^PN[0-9a-f]{32}$/i.test(sid));
}
