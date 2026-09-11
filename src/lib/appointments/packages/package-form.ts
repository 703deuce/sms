import type { PackageCreditRule } from "@/lib/appointments/service-booking/types";

export type PackageFormState = {
  name: string;
  description: string;
  priceCents: number;
  totalCredits: number;
  creditUnitLabel: string;
  expirationMode: "none" | "days" | "fixed";
  expirationDays: number;
  expirationDate: string;
  active: boolean;
  directPurchase: boolean;
  eligibleServiceIds: string[];
  eligibleClassIds: string[];
  eligibleWorkshopIds: string[];
};

export const EMPTY_PACKAGE_FORM: PackageFormState = {
  name: "",
  description: "",
  priceCents: 0,
  totalCredits: 1,
  creditUnitLabel: "booking credits",
  expirationMode: "none",
  expirationDays: 90,
  expirationDate: "",
  active: true,
  directPurchase: true,
  eligibleServiceIds: [],
  eligibleClassIds: [],
  eligibleWorkshopIds: [],
};

export type PackageProductApiRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  creditRules: PackageCreditRule[] | unknown;
  expirationDays: number | null;
  active: boolean;
  directPurchase: boolean;
  metadata?: { creditUnitLabel?: string; expirationMode?: string; expirationDate?: string } | null;
  ownerCount?: number;
};

export function totalCreditsFromRules(rules: PackageCreditRule[]): number {
  return rules
    .filter((rule) => rule.quantity > 0)
    .reduce((sum, rule) => sum + rule.quantity, 0);
}

export function packageFormFromRow(row: PackageProductApiRow): PackageFormState {
  const rules = (row.creditRules || []) as PackageCreditRule[];
  const meta = (row.metadata || {}) as PackageFormState & Record<string, unknown>;
  return {
    name: row.name,
    description: row.description || "",
    priceCents: row.priceCents,
    totalCredits: totalCreditsFromRules(rules) || 1,
    creditUnitLabel: String(meta.creditUnitLabel || "booking credits"),
    expirationMode:
      meta.expirationMode === "fixed"
        ? "fixed"
        : row.expirationDays != null
          ? "days"
          : "none",
    expirationDays: row.expirationDays ?? 90,
    expirationDate: String(meta.expirationDate || ""),
    active: row.active,
    directPurchase: row.directPurchase,
    eligibleServiceIds: rules.filter((r) => r.bookingTypeId).map((r) => String(r.bookingTypeId)),
    eligibleClassIds: rules
      .filter((r) => r.classSeriesId && r.label !== "Workshop")
      .map((r) => String(r.classSeriesId)),
    eligibleWorkshopIds: rules
      .filter((r) => r.classSeriesId && r.label === "Workshop")
      .map((r) => String(r.classSeriesId)),
  };
}

export function buildCreditRules(form: PackageFormState): PackageCreditRule[] {
  const rules: PackageCreditRule[] = [];
  if (form.totalCredits > 0) {
    rules.push({
      quantity: form.totalCredits,
      label: `${form.totalCredits} ${form.creditUnitLabel}`,
    });
  }
  for (const id of form.eligibleServiceIds) {
    rules.push({ bookingTypeId: id, quantity: 0, label: "Service" });
  }
  for (const id of form.eligibleClassIds) {
    rules.push({ classSeriesId: id, quantity: 0, label: "Class" });
  }
  for (const id of form.eligibleWorkshopIds) {
    rules.push({ classSeriesId: id, quantity: 0, label: "Workshop" });
  }
  return rules;
}

export function packageSavePayload(form: PackageFormState, id?: string) {
  const expirationDays =
    form.expirationMode === "days" ? Math.max(1, form.expirationDays) : null;
  return {
    id,
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    priceCents: form.priceCents,
    creditRules: buildCreditRules(form),
    expirationDays,
    active: form.active,
    directPurchase: form.directPurchase,
    metadata: {
      creditUnitLabel: form.creditUnitLabel,
      expirationMode: form.expirationMode,
      expirationDate: form.expirationMode === "fixed" ? form.expirationDate : undefined,
    },
  };
}

export function validatePackageForm(form: PackageFormState): string | null {
  if (!form.name.trim()) return "Package name is required";
  if (form.totalCredits < 1) return "A package must include at least one credit";
  if (form.priceCents < 0) return "Price cannot be negative";
  if (
    form.eligibleServiceIds.length +
      form.eligibleClassIds.length +
      form.eligibleWorkshopIds.length ===
    0
  ) {
    return "Choose at least one eligible booking";
  }
  if (form.expirationMode === "days" && form.expirationDays < 1) {
    return "Expiration must be at least one day";
  }
  if (form.expirationMode === "fixed" && !form.expirationDate) {
    return "Choose an expiration date";
  }
  return null;
}

export function eligibilitySummary(rules: PackageCreditRule[]): {
  services: number;
  classes: number;
  workshops: number;
  total: number;
} {
  const services = rules.filter((r) => r.bookingTypeId).length;
  const classes = rules.filter((r) => r.classSeriesId && r.label === "Class").length;
  const workshops = rules.filter((r) => r.classSeriesId && r.label === "Workshop").length;
  return { services, classes, workshops, total: services + classes + workshops };
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function packageGrantsOffering(
  rules: PackageCreditRule[],
  offering: { kind: "service" | "class" | "workshop"; id: string },
): boolean {
  if (offering.kind === "service") {
    return rules.some((r) => r.bookingTypeId === offering.id);
  }
  const label = offering.kind === "workshop" ? "Workshop" : "Class";
  return rules.some((r) => r.classSeriesId === offering.id && r.label === label);
}
