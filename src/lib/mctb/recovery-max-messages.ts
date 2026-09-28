/** Customer-facing cap for max automated recovery texts per caller (within cooldown). */
export const MCTB_MAX_MESSAGES_PER_CALLER_UI_MAX = 5;

export function clampMctbMaxMessagesPerCaller(value: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(MCTB_MAX_MESSAGES_PER_CALLER_UI_MAX, Math.max(1, n));
}

export const MCTB_MAX_MESSAGES_PER_CALLER_OPTIONS = ["1", "2", "3", "5"] as const;

export function mctbMaxMessagesSelectOptions(current: number): string[] {
  const clamped = String(clampMctbMaxMessagesPerCaller(current));
  const set = new Set<string>([...MCTB_MAX_MESSAGES_PER_CALLER_OPTIONS]);
  set.add(clamped);
  return [...set].sort((a, b) => Number(a) - Number(b));
}
