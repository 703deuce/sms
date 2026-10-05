/** Guess a first name from a free-text SMS reply (presentation only — not structured extraction). */
export function guessCallerFirstNameFromReply(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const firstSegment = trimmed.split(/[,.\n]/)[0]?.trim() ?? "";
  const firstToken = firstSegment.split(/\s+/)[0]?.trim() ?? "";
  if (!firstToken || firstToken.length > 24) return null;
  if (!/^[A-Za-z][A-Za-z'-]{0,23}$/.test(firstToken)) return null;
  const lower = firstToken.toLowerCase();
  if (["hi", "hello", "hey", "yes", "no", "thanks", "thank"].includes(lower)) return null;
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
}

export type MctbFirstReplyAckInput = {
  businessName: string;
  callbackTimePhrase: string;
  callerFirstName?: string | null;
  /** When false, prefer "contact you" wording over "call you back" for impossible same-day promises. */
  inBusinessHours: boolean;
};

export function renderMctbDeterministicFirstReplyAck(input: MctbFirstReplyAckInput): string {
  const business = input.businessName.trim() || "We";
  const callback = input.callbackTimePhrase.trim() || "as soon as possible";
  const name = input.callerFirstName?.trim();
  const thanks = name ? `Thanks, ${name}.` : "Thanks.";

  const callbackSentence = input.inBusinessHours
    ? `${business} will call you back ${callback}.`
    : `${business} will contact you ${callback}.`;

  return `${thanks} We got your message. ${callbackSentence}`;
}

export function readRecoveryContextFromMissedCallMetadata(
  metadata: unknown,
): {
  businessName: string | null;
  callbackTimePhrase: string | null;
  inBusinessHours: boolean | null;
} {
  const row =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return {
    businessName:
      typeof row.recoveryBusinessName === "string" ? row.recoveryBusinessName : null,
    callbackTimePhrase:
      typeof row.recoveryCallbackTimePhrase === "string"
        ? row.recoveryCallbackTimePhrase
        : null,
    inBusinessHours:
      typeof row.recoveryInBusinessHours === "boolean" ? row.recoveryInBusinessHours : null,
  };
}
