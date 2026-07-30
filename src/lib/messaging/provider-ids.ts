/** Detect Twilio Messaging Service SIDs so we never treat them as Telnyx profile IDs. */
export function looksLikeTwilioMessagingServiceSid(sid: string | null | undefined): boolean {
  return Boolean(sid && /^MG/i.test(sid));
}

export function looksLikeTwilioPhoneSid(sid: string | null | undefined): boolean {
  return Boolean(sid && /^PN/i.test(sid));
}

/** Normalize Telnyx JSON bodies that may be `{ data: T }` or bare `T`. */
export function unwrapTelnyxData<T extends Record<string, unknown>>(res: unknown): T {
  if (!res || typeof res !== "object") return {} as T;
  const root = res as Record<string, unknown>;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data as T;
  }
  return root as T;
}
