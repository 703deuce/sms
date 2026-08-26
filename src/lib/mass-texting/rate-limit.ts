import { MASS_TEXT_LAUNCH_RATE_LIMIT_PER_MINUTE } from "@/lib/mass-texting/constants";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function consumeMassTextRateLimit(
  key: string,
  limit = MASS_TEXT_LAUNCH_RATE_LIMIT_PER_MINUTE,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (current.count >= limit) {
    return { ok: false, retryAfterMs: Math.max(0, current.resetAt - now) };
  }
  current.count += 1;
  return { ok: true };
}

export function resetMassTextRateLimitForTests() {
  buckets.clear();
}
