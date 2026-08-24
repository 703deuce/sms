/** Pure helpers for consent log — safe to import from tests. */

export function missedCallIdempotencyKey(workspaceId: string, callSessionId: string): string {
  return `missed-call-text:${workspaceId}:${callSessionId}`;
}

export function asConsentMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
