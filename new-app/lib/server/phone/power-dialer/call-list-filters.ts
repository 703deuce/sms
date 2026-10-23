/** Pure filter helpers for power-dialer call history (HumanCall queries). */

export function parseHasRecordingParam(value: string | null | undefined): boolean | undefined {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return undefined;
}

export function mergeCallFilterOr(
  existing: unknown,
  orClause: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (Array.isArray(existing)) return [...(existing as Record<string, unknown>[]), ...orClause];
  return orClause;
}
