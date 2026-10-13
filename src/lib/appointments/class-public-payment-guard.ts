import { parseClassSeriesMetadata } from "@/lib/appointments/class-series-offering";

/**
 * Phase 0 — block silent free enrollment when a series is priced but checkout is not wired.
 * Returns a customer-facing reason, or null when registration may proceed (free, package, or paid flow later).
 */
export function classPaidEnrollmentBlockedReason(metadata: unknown): string | null {
  const meta = parseClassSeriesMetadata(metadata);
  const priceCents = Number(meta.priceCents ?? 0);
  if (meta.isFree === true || priceCents <= 0) return null;
  if (meta.paymentMode === "free") return null;
  if (meta.paymentMode === "package_only") return null;

  if (meta.paymentMode === "pay_at_registration") {
    return "Online payment is required to register. Checkout is not available on this page yet — please contact the business.";
  }

  // Legacy / on_site: priced series must not enroll without package or payment.
  return "Registration requires payment or an eligible package. Purchase a package from the business store or contact them to register.";
}

function priceCents(meta: ReturnType<typeof parseClassSeriesMetadata>): number {
  return Number(meta.priceCents ?? 0);
}

/** Public POST may enroll with package credit when priced if package_only or legacy priced + packageBalanceId. */
export function classRequiresPackageToEnroll(metadata: unknown): boolean {
  const meta = parseClassSeriesMetadata(metadata);
  const price = priceCents(meta);
  if (meta.isFree === true || price <= 0) return false;
  if (meta.paymentMode === "free") return false;
  if (meta.paymentMode === "pay_at_registration") return false;
  return true;
}

/** Block enroll POST when priced series needs a package credit and none was supplied. */
export function classPackageCreditRequiredReason(
  metadata: unknown,
  packageBalanceId?: string | null,
): string | null {
  if (!classRequiresPackageToEnroll(metadata)) return null;
  if (packageBalanceId) return null;
  const meta = parseClassSeriesMetadata(metadata);
  if (meta.paymentMode === "package_only") {
    return "Purchase an eligible package from the business store, then register with the same phone number you used at checkout.";
  }
  return "Registration requires an eligible package. Purchase from the store or contact the business.";
}

/** Paid guard applies to listing; package redemption may bypass for POST only. */
export function classPaidEnrollmentBlockedForPublicListing(metadata: unknown): string | null {
  return classPaidEnrollmentBlockedReason(metadata);
}
