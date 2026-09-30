/** Free tier: logical missed-call recoveries per monthly period (not SMS segments). */
export const MCTB_FREE_MONTHLY_RECOVERY_LIMIT = 10;

/**
 * Paid Recovery plan allowance per Stripe/catalog tier (logical MCTB_RECOVERY units / month).
 * Marketing price lives in Stripe; these limits are product-authoritative for launch.
 */
export const MCTB_PAID_RECOVERY_LIMIT_BY_TIER: Record<string, number> = {
  starter: 250,
  growth: 750,
  pro: 2500,
};

/** When paid tier is unknown but recovery is entitled, use starter-equivalent allowance. */
export const MCTB_PAID_RECOVERY_LIMIT_FALLBACK = MCTB_PAID_RECOVERY_LIMIT_BY_TIER.starter;

export function resolveMctbMonthlyRecoveryLimit(input: {
  mctbProductActive: boolean;
  recoveryPaid: boolean;
  paidTier: string | null;
}): number {
  if (!input.mctbProductActive) return 0;
  if (!input.recoveryPaid) return MCTB_FREE_MONTHLY_RECOVERY_LIMIT;
  const tier = String(input.paidTier || "starter").toLowerCase();
  return MCTB_PAID_RECOVERY_LIMIT_BY_TIER[tier] ?? MCTB_PAID_RECOVERY_LIMIT_FALLBACK;
}

/** Calendar month bucket in UTC (authoritative period until billing-period hook is wired). */
export function currentMctbRecoveryPeriodKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
