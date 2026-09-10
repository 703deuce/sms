import type { PackageCreditRule, PackageLifecyclePolicy } from "@/lib/appointments/service-booking/types";

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function sumPackageCredits(rules: PackageCreditRule[] | undefined) {
  return (rules || []).reduce((sum, rule) => sum + rule.quantity, 0);
}

export function validityLabel(expirationDays: number | null | undefined) {
  if (expirationDays == null) return "Never expires";
  if (expirationDays >= 30 && expirationDays % 30 === 0) {
    const months = expirationDays / 30;
    return `Expires ${months} month${months === 1 ? "" : "s"} after purchase`;
  }
  return `Expires ${expirationDays} day${expirationDays === 1 ? "" : "s"} after purchase`;
}

export function membershipStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    case "expired":
      return "Expired";
    case "pending":
      return "Pending";
    default:
      return status.replace(/_/g, " ");
  }
}

export function billingIntervalLabel(interval: string) {
  switch (interval) {
    case "month":
      return "Monthly";
    case "year":
      return "Yearly";
    case "quarter":
      return "Quarterly";
    case "week":
      return "Weekly";
    default:
      return interval;
  }
}

export function readLifecyclePolicy(metadata: unknown): PackageLifecyclePolicy {
  if (!metadata || typeof metadata !== "object") return {};
  return ((metadata as { lifecyclePolicy?: PackageLifecyclePolicy }).lifecyclePolicy ||
    {}) as PackageLifecyclePolicy;
}

export function readMembershipLifecycle(metadata: unknown) {
  const base = {
    cancelMode: "end_of_period" as "immediate" | "end_of_period",
    pauseAllowed: true,
    failedPaymentBehavior: "suspend" as "suspend" | "grace",
    gracePeriodDays: 3,
    creditRollover: false,
    maxRollover: 0,
  };
  if (!metadata || typeof metadata !== "object") return base;
  const lifecycle = (metadata as { lifecycle?: Partial<typeof base> }).lifecycle;
  return { ...base, ...lifecycle };
}
