/** Parse wizard min-notice strings ("2 hours", "1 day", "30") into minutes. */
export function parseNoticeMinutes(raw: string | null | undefined): number {
  if (!raw) return 0;
  const s = String(raw).trim().toLowerCase();
  if (!s) return 0;
  const num = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (s.includes("day")) return Math.round(num * 24 * 60);
  if (s.includes("hour")) return Math.round(num * 60);
  if (s.includes("min")) return Math.round(num);
  // bare number → treat as minutes
  return Math.round(num);
}
