/** Free tier: missed calls texted back per calendar month (one unit per call, not per SMS). */
export const MCTB_FREE_MONTHLY_RECOVERY_LIMIT = 10;

/** Text Back ($9.99/mo) — paid MCTB platform subscription. */
export const MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT = 50;

/** AI Recovery ($19.99/mo) — includes higher recovery allowance. */
export const MCTB_AI_RECOVERY_MONTHLY_RECOVERY_LIMIT = 100;

/**
 * Legacy Stripe tier keys on `mctb` product family — all map to Text Back allowance at launch.
 * Prefer catalog tier `text_back` for new subscriptions.
 */
export const MCTB_PAID_RECOVERY_LIMIT_BY_TIER: Record<string, number> = {
  text_back: MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT,
  starter: MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT,
  growth: MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT,
  pro: MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT,
};

/** When paid tier is unknown but recovery is entitled, use Text Back allowance. */
export const MCTB_PAID_RECOVERY_LIMIT_FALLBACK = MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT;

export function resolveMctbMonthlyRecoveryLimit(input: {
  mctbProductActive: boolean;
  recoveryPaid: boolean;
  aiRecoveryEntitled?: boolean;
  paidTier: string | null;
}): number {
  if (!input.mctbProductActive) return 0;
  if (input.aiRecoveryEntitled) return MCTB_AI_RECOVERY_MONTHLY_RECOVERY_LIMIT;
  if (input.recoveryPaid) return MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT;
  return MCTB_FREE_MONTHLY_RECOVERY_LIMIT;
}

/** Calendar month bucket in UTC (authoritative period until billing-period hook is wired). */
export function currentMctbRecoveryPeriodKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Half-open UTC interval [start, end) for a `YYYY-MM` recovery usage period. */
export function mctbRecoveryPeriodUtcBounds(periodKey: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey.trim());
  if (!match) {
    const now = new Date();
    return mctbRecoveryPeriodUtcBounds(currentMctbRecoveryPeriodKey(now));
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return { start, end };
}
