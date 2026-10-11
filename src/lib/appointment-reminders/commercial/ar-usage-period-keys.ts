/** Pure period key helpers (safe for unit tests without server-only). */

export function buildArUsagePeriodKey(start: Date, end: Date): string {
  return `${start.toISOString()}__${end.toISOString()}`;
}

export function parseArUsagePeriodKey(key: string): { start: Date; end: Date } | null {
  const parts = key.split("__");
  if (parts.length !== 2) return null;
  const start = new Date(parts[0]);
  const end = new Date(parts[1]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}
