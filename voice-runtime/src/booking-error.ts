/** Classify Calendly / booking errors for caller-facing copy and retry policy. */

export function isCalendlyRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b429\b|too many requests|rate.?limit/i.test(message);
}

export function isCalendlySlotError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /not available|already has booking|slot/i.test(message);
}

export function bookingFailureReason(err: unknown): string {
  if (isCalendlyRateLimitError(err)) {
    return "Our scheduling system is busy right now — let's try again in a moment or pick another time.";
  }
  if (isCalendlySlotError(err)) {
    return "That time slot isn't available anymore — I can check what else is open.";
  }
  return "That booking didn't go through on our calendar — we can try again or pick another time.";
}

/** Backoff delays (ms) after a 429 before retrying Calendly book. */
export const CALENDLY_RATE_LIMIT_RETRY_DELAYS_MS = [2_000, 4_000, 8_000] as const;

export function isCalendlyAlreadyCancelledError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /already cancel|already canceled|not found|404/i.test(message);
}
