/**
 * Public booking rate limits are opt-in via PUBLIC_BOOKING_RATE_LIMIT_ENABLED=1.
 * Disabled by default so browser UAT / cert flows are not blocked by slot holds,
 * entitlement lookups, and repeated booking attempts sharing one IP.
 */

const PUBLIC_BOOKING_RATE = new Map<string, number[]>();

export function publicBookingRateLimitEnabled(): boolean {
  const v = process.env.PUBLIC_BOOKING_RATE_LIMIT_ENABLED;
  return v === "1" || v === "true";
}

/** Only rate-limit destructive / expensive actions (default: book submit). */
export function shouldRateLimitPublicBookingAction(action: string): boolean {
  if (!publicBookingRateLimitEnabled()) return false;
  return action === "book";
}

export function enforcePublicBookingRateLimit(
  workspaceId: string,
  ip: string,
  action = "book",
): boolean {
  if (!shouldRateLimitPublicBookingAction(action)) return true;

  const key = `${workspaceId}:${ip}:${action}`;
  const now = Date.now();
  const windowMs = 60_000;
  const max = 30;
  const list = (PUBLIC_BOOKING_RATE.get(key) || []).filter((t) => t >= now - windowMs);
  if (list.length >= max) return false;
  list.push(now);
  PUBLIC_BOOKING_RATE.set(key, list);
  return true;
}

export function enforcePublicBookingAiRateLimit(workspaceId: string, ip: string): boolean {
  if (!publicBookingRateLimitEnabled()) return true;

  const key = `${workspaceId}:${ip}:ai`;
  const now = Date.now();
  const list = (PUBLIC_BOOKING_RATE.get(key) || []).filter((t) => t >= now - 60_000);
  if (list.length >= 15) return false;
  list.push(now);
  PUBLIC_BOOKING_RATE.set(key, list);
  return true;
}
