/** Free tier: logical missed-call recoveries per monthly period (not SMS segments). */
export const MCTB_FREE_MONTHLY_RECOVERY_LIMIT = 25;

/** Calendar month bucket in UTC (authoritative period until billing-period hook is wired). */
export function currentMctbRecoveryPeriodKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
