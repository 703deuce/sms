/** Free tier: missed calls texted back per calendar month (first automated SMS accepted). */
export const MCTB_FREE_MONTHLY_RECOVERY_LIMIT = 25;

/** Pro ($19.99/mo) — primary paid MCTB subscription. */
export const MCTB_PRO_MONTHLY_RECOVERY_LIMIT = 300;

/** @deprecated Legacy alias — use MCTB_PRO_MONTHLY_RECOVERY_LIMIT */
export const MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT = MCTB_PRO_MONTHLY_RECOVERY_LIMIT;

/** @deprecated Legacy AI SKU — allowance matches Pro when entitled */
export const MCTB_AI_RECOVERY_MONTHLY_RECOVERY_LIMIT = MCTB_PRO_MONTHLY_RECOVERY_LIMIT;

/**
 * Stripe tier keys on `mctb` product family.
 * New checkouts use `pro`; legacy `text_back` subscribers keep Pro allowance.
 */
export const MCTB_PAID_RECOVERY_LIMIT_BY_TIER: Record<string, number> = {
  text_back: MCTB_PRO_MONTHLY_RECOVERY_LIMIT,
  starter: MCTB_PRO_MONTHLY_RECOVERY_LIMIT,
  growth: MCTB_PRO_MONTHLY_RECOVERY_LIMIT,
  pro: MCTB_PRO_MONTHLY_RECOVERY_LIMIT,
};

export const MCTB_PAID_RECOVERY_LIMIT_FALLBACK = MCTB_PRO_MONTHLY_RECOVERY_LIMIT;

export function resolveMctbMonthlyRecoveryLimit(input: {
  mctbProductActive: boolean;
  recoveryPaid: boolean;
  aiRecoveryEntitled?: boolean;
  paidTier: string | null;
}): number {
  if (!input.mctbProductActive) return 0;
  if (input.aiRecoveryEntitled) return MCTB_PRO_MONTHLY_RECOVERY_LIMIT;
  if (input.recoveryPaid) {
    const tier = input.paidTier?.trim();
    if (tier && MCTB_PAID_RECOVERY_LIMIT_BY_TIER[tier]) {
      return MCTB_PAID_RECOVERY_LIMIT_BY_TIER[tier];
    }
    return MCTB_PAID_RECOVERY_LIMIT_FALLBACK;
  }
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
