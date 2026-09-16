/** Phrases that represent booking intent only — not a real service/reason field value. */
const BOOKING_INTENT_ONLY = new Set([
  "book an appointment",
  "book appointment",
  "schedule an appointment",
  "schedule appointment",
  "make an appointment",
  "need an appointment",
  "need to book",
  "need to book an appointment",
  "want to book",
  "want to book an appointment",
  "want to schedule",
  "want to schedule an appointment",
  "i need to book an appointment",
  "i need to book",
  "i want to book an appointment",
  "i want to schedule an appointment",
  "get an appointment",
  "set up an appointment",
  "arrange an appointment",
]);

function normalizeIntentPhrase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.!?,]/g, "")
    .replace(/\s+/g, " ");
}

export function isBookingIntentOnlyServiceReason(value: string): boolean {
  const n = normalizeIntentPhrase(value);
  if (!n) return false;
  if (BOOKING_INTENT_ONLY.has(n)) return true;
  if (n.length < 48 && /^(i\s+)?(need|want)\s+to\s+(book|schedule)\b/.test(n) && !/\b(leak|sink|repair|fix|install)\b/.test(n)) {
    return true;
  }
  return false;
}

export function stripBookingIntentOnlyServiceReason(
  normalized: Partial<Record<string, string>>,
): Partial<Record<string, string>> {
  const sr = normalized.service_reason;
  if (sr && isBookingIntentOnlyServiceReason(sr)) {
    const next = { ...normalized };
    delete next.service_reason;
    return next;
  }
  return normalized;
}
