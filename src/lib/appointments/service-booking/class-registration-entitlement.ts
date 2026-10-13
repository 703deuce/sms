import "server-only";

import { parseClassSeriesMetadata } from "@/lib/appointments/class-series-offering";
import {
  classPackageCreditRequiredReason,
  classRequiresPackageToEnroll,
} from "@/lib/appointments/class-public-payment-guard";

export type ClassRegistrationEntitlementInput = {
  packageBalanceId?: string | null;
  membershipSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
};

/** Whether POST supplied an entitlement path the server will validate (not trust blindly). */
export function classRegistrationEntitlementSupplied(
  input: ClassRegistrationEntitlementInput,
): boolean {
  return Boolean(
    input.packageBalanceId ||
      input.membershipSubscriptionId ||
      input.stripeCheckoutSessionId,
  );
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
