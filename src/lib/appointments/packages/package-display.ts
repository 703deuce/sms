import type { PackageCreditRule, PackageLifecyclePolicy } from "@/lib/appointments/service-booking/types";

export function readPackageLifecyclePolicyClient(
  metadata: Record<string, unknown> | null | undefined,
): PackageLifecyclePolicy {
  const policy = metadata?.lifecyclePolicy;
  if (policy && typeof policy === "object") {
    return policy as PackageLifecyclePolicy;
  }
  return {
    restoreCreditsOnCancel: true,
    restoreCreditsOnLateCancel: false,
    restoreCreditsOnNoShow: false,
  };
}

export type PackageProductRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceCents: number;
  creditRules?: PackageCreditRule[] | unknown;
  expirationDays?: number | null;
  active?: boolean;
};

export function formatPackagePrice(cents: number): string {
  if (!cents) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

export function packageCreditsSummary(rules?: PackageCreditRule[] | unknown): string {
  const rows = (rules || []) as PackageCreditRule[];
  if (!rows.length) return "—";
  const total = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  if (rows.length === 1 && rows[0].label) return `${total} · ${rows[0].label}`;
  if (rows.length === 1) return `${total} session${total === 1 ? "" : "s"}`;
  return rows.map((r) => `${r.quantity} ${r.label || "credits"}`).join(" + ");
}

export function packageValidityLabel(days?: number | null): string {
  if (days == null || days <= 0) return "No expiration";
  if (days === 30) return "30 days";
  if (days === 90) return "3 months";
  if (days === 180) return "6 months";
  if (days === 365) return "1 year";
  return `${days} days`;
}

export function packageIsActive(row: PackageProductRow): boolean {
  return row.active !== false;
}
