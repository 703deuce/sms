import type { MembershipBenefits } from "@/lib/appointments/service-booking/types";

export type MembershipProductRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceCents: number;
  billingInterval: string;
  benefits?: MembershipBenefits | unknown;
  active?: boolean;
};

export function formatMembershipPrice(cents: number, interval: string): string {
  const price = cents ? `$${(cents / 100).toFixed(2)}` : "Free";
  const label =
    interval === "month"
      ? "/ month"
      : interval === "year"
        ? "/ year"
        : interval === "quarter"
          ? "/ quarter"
          : ` / ${interval}`;
  return `${price}${label}`;
}

export function membershipBenefitsSummary(benefits?: MembershipBenefits | unknown): string {
  const b = (benefits || {}) as MembershipBenefits;
  const parts: string[] = [];
  const credits = b.includedCredits || [];
  if (credits.length) {
    const total = credits.reduce((s, c) => s + (c.quantity || 0), 0);
    parts.push(`${total} credits`);
  }
  if (b.percentDiscount) parts.push(`${b.percentDiscount}% off`);
  if ((b.memberOnlyTypeIds || []).length) parts.push("Member-only access");
  return parts.length ? parts.join(" · ") : "Benefits configured";
}

export function membershipBillingLabel(interval: string): string {
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

export function membershipIsActive(row: MembershipProductRow): boolean {
  return row.active !== false;
}

export function membershipStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Canceled";
    default:
      return status;
  }
}
