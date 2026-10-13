import "server-only";

import {
  parseClassSeriesMetadata,
} from "@/lib/appointments/class-series-offering";
import {
  classPackageCreditRequiredReason,
  classRequiresPackageToEnroll,
} from "@/lib/appointments/class-public-payment-guard";

export type ClassRegistrationEntitlementInput = {
  packageBalanceId?: string | null;
  membershipSubscriptionId?: string | null;
};

/** Whether POST supplied package/membership the server will validate (not trust blindly). */
export function classRegistrationEntitlementSupplied(
  input: ClassRegistrationEntitlementInput,
): boolean {
  return Boolean(input.packageBalanceId || input.membershipSubscriptionId);
}

/** Blocks direct enroll POST when Stripe checkout is required (payment verified only on fulfill path). */
export function classDirectEnrollBlockedReason(metadata: unknown): string | null {
  const meta = parseClassSeriesMetadata(metadata);
  const priceCents = Number(meta.priceCents ?? 0);
  if (meta.isFree === true || priceCents <= 0) return null;
  if (meta.paymentMode === "pay_at_registration") {
    return "Payment is required. Use Pay & register to complete checkout.";
  }
  return null;
}

/**
 * Customer-facing block when priced series requires package/membership/payment proof.
 * Membership and payment paths are accepted here; server validates ownership separately.
 */
export function classRegistrationPaymentRequiredReason(
  metadata: unknown,
  input: ClassRegistrationEntitlementInput,
): string | null {
  if (!classRequiresPackageToEnroll(metadata)) return null;
  if (classRegistrationEntitlementSupplied(input)) return null;
  return classPackageCreditRequiredReason(metadata, null);
}

export function seriesAllowsMembershipEntitlement(metadata: unknown): boolean {
  const meta = parseClassSeriesMetadata(metadata);
  const ids = meta.membershipProductIds || [];
  return ids.length > 0 || meta.memberOnly === true;
}
