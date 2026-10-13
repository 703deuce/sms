import type { PackageCreditRule } from "./types";

/** Legacy pooled bucket used when rules do not name a booking type. */
export const PACKAGE_CREDIT_KEY_DEFAULT = "default";

const TYPE_PREFIX = "type:";
const SERIES_PREFIX = "series:";

export function creditKeyForBookingType(bookingTypeId: string): string {
  return `${TYPE_PREFIX}${bookingTypeId}`;
}

export function creditKeyForClassSeries(classSeriesId: string): string {
  return `${SERIES_PREFIX}${classSeriesId}`;
}

/** Canonical mint key for a positive-quantity rule (new balances). */
export function mintCreditKeyForRule(rule: PackageCreditRule): string {
  if (rule.bookingTypeId) return creditKeyForBookingType(rule.bookingTypeId);
  if (rule.classSeriesId) return creditKeyForClassSeries(rule.classSeriesId);
  if (rule.serviceName) return rule.serviceName;
  return PACKAGE_CREDIT_KEY_DEFAULT;
}

/** Build initial `remainingCredits` from product rules (purchase / admin grant). */
export function mintRemainingCreditsFromRules(rules: PackageCreditRule[]): Record<string, number> {
  const remainingCredits: Record<string, number> = {};
  for (const rule of rules) {
    if (!rule.quantity || rule.quantity <= 0) continue;
    const key = mintCreditKeyForRule(rule);
    remainingCredits[key] = (remainingCredits[key] || 0) + rule.quantity;
  }
  if (Object.keys(remainingCredits).length === 0) {
    remainingCredits[PACKAGE_CREDIT_KEY_DEFAULT] = 1;
  }
  return remainingCredits;
}

function readBalance(remaining: Record<string, number>, key: string): number {
  return remaining[key] ?? 0;
}

/**
 * Resolve which balance key to debit for a service/meeting booking.
 * Tries canonical `type:{id}`, legacy bare `bookingTypeId`, then pooled fallbacks.
 */
export function resolveBookingCreditKey(
  remainingCredits: Record<string, number>,
  bookingTypeId?: string,
  serviceName?: string,
): string | null {
  if (bookingTypeId) {
    const canonical = creditKeyForBookingType(bookingTypeId);
    if (readBalance(remainingCredits, canonical) > 0) return canonical;
    if (readBalance(remainingCredits, bookingTypeId) > 0) return bookingTypeId;
  }
  if (serviceName && readBalance(remainingCredits, serviceName) > 0) return serviceName;
  if (readBalance(remainingCredits, PACKAGE_CREDIT_KEY_DEFAULT) > 0) {
    return PACKAGE_CREDIT_KEY_DEFAULT;
  }
  if (!bookingTypeId && !serviceName) {
    for (const [key, value] of Object.entries(remainingCredits)) {
      if (value > 0) return key;
    }
  }
  return null;
}

/**
 * Resolve which balance key to debit for class/workshop registration.
 * Tries `series:{id}`, then pooled default / legacy keys.
 */
export function resolveClassSeriesCreditKey(
  remainingCredits: Record<string, number>,
  classSeriesId: string,
): string | null {
  const canonical = creditKeyForClassSeries(classSeriesId);
  if (readBalance(remainingCredits, canonical) > 0) return canonical;
  if (readBalance(remainingCredits, classSeriesId) > 0) return classSeriesId;
  if (readBalance(remainingCredits, PACKAGE_CREDIT_KEY_DEFAULT) > 0) {
    return PACKAGE_CREDIT_KEY_DEFAULT;
  }
  return null;
}

/** Sum of all positive buckets (display). */
export function packageCreditsRemaining(remainingCredits: Record<string, number>): number {
  return Object.values(remainingCredits).reduce((sum, n) => sum + (n || 0), 0);
}
