/** Minimal idempotency helper for integration jobs (full worker stack lives in monolith). */
export function makeEventIdempotencyKey(parts: string[]): string {
  return parts.filter(Boolean).join(":");
}
