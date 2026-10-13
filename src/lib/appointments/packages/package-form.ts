import type { PackageCreditRule } from "@/lib/appointments/service-booking/types";

export type PackageKind = "pooled" | "itemized";

/** Business-facing template — maps to `packageKind` and default copy, not DB fields. */
export type PackageSellTemplate =
  | "prepaid_sessions"
  | "bundle_classes"
  | "mixed_bundle"
  | "custom";

export type PackageFormState = {
  packageKind: PackageKind;
  sellTemplate: PackageSellTemplate;
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
  eligibleMeetingIds: string[];
  eligibleClassIds: string[];
  eligibleWorkshopIds: string[];
  /** Per-offering quantities when `packageKind === "itemized"`. */
  itemizedQuantities: Record<string, number>;
  maxPurchasesPerCustomer: number | null;
  /** Public storefront cover — stored in product metadata. */
  imageUrl: string;
};

export const EMPTY_PACKAGE_FORM: PackageFormState = {
  packageKind: "pooled",
  sellTemplate: "prepaid_sessions",
  name: "",
  description: "",
  priceCents: 0,
  totalCredits: 1,
  creditUnitLabel: "sessions",
  expirationMode: "none",
  expirationDays: 90,
  expirationDate: "",
  active: true,
  directPurchase: true,
  eligibleServiceIds: [],
  eligibleMeetingIds: [],
  eligibleClassIds: [],
  eligibleWorkshopIds: [],
  itemizedQuantities: {},
  maxPurchasesPerCustomer: null,
  imageUrl: "",
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
  metadata?: {
    packageKind?: PackageKind;
    sellTemplate?: PackageSellTemplate;
    creditUnitLabel?: string;
    expirationMode?: string;
    expirationDate?: string;
    maxPurchasesPerCustomer?: number;
  } | null;
  ownerCount?: number;
};

export function itemizedQuantityKey(
  kind: "service" | "meeting" | "class" | "workshop",
  id: string,
): string {
  return `${kind}:${id}`;
}

function itemizedKey(kind: "service" | "meeting" | "class" | "workshop", id: string): string {
  return itemizedQuantityKey(kind, id);
}

export function parseItemizedKey(key: string): { kind: string; id: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  return { kind: key.slice(0, idx), id: key.slice(idx + 1) };
}

function detectPackageKindFromRules(rules: PackageCreditRule[]): PackageKind {
  const positiveTyped = rules.filter(
    (r) =>
      r.quantity > 0 && (Boolean(r.bookingTypeId) || Boolean(r.classSeriesId) || Boolean(r.serviceName)),
  );
  if (positiveTyped.length >= 2) return "itemized";
  if (positiveTyped.length === 1 && !rules.some((r) => r.quantity > 0 && !r.bookingTypeId && !r.classSeriesId)) {
    return "itemized";
  }
  const pooledOnly = rules.some((r) => r.quantity > 0 && !r.bookingTypeId && !r.classSeriesId);
  return pooledOnly ? "pooled" : "itemized";
}

export function totalCreditsFromRules(rules: PackageCreditRule[]): number {
  return rules
    .filter((rule) => rule.quantity > 0)
    .reduce((sum, rule) => sum + rule.quantity, 0);
}

export function packageFormFromRow(row: PackageProductApiRow): PackageFormState {
  const rules = (row.creditRules || []) as PackageCreditRule[];
  const meta = (row.metadata || {}) as PackageFormState & Record<string, unknown>;
  const packageKind =
    meta.packageKind === "itemized" || meta.packageKind === "pooled"
      ? meta.packageKind
      : detectPackageKindFromRules(rules);

  const itemizedQuantities: Record<string, number> = {};
  for (const r of rules) {
    if (r.quantity <= 0) continue;
    if (r.bookingTypeId) {
      const kind = r.label === "Meeting" ? "meeting" : "service";
      itemizedQuantities[itemizedKey(kind, String(r.bookingTypeId))] = r.quantity;
    } else if (r.classSeriesId) {
      const kind = r.label === "Workshop" ? "workshop" : "class";
      itemizedQuantities[itemizedKey(kind, String(r.classSeriesId))] = r.quantity;
    }
  }

  const pooledRule = rules.find((r) => r.quantity > 0 && !r.bookingTypeId && !r.classSeriesId);

  return {
    packageKind,
    sellTemplate:
      meta.sellTemplate === "bundle_classes" ||
      meta.sellTemplate === "mixed_bundle" ||
      meta.sellTemplate === "prepaid_sessions" ||
      meta.sellTemplate === "custom"
        ? meta.sellTemplate
        : packageKind === "itemized"
          ? "bundle_classes"
          : "prepaid_sessions",
    name: row.name,
    description: row.description || "",
    priceCents: row.priceCents,
    totalCredits: pooledRule?.quantity ?? (totalCreditsFromRules(rules) || 1),
    creditUnitLabel: String(meta.creditUnitLabel || "sessions"),
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
    maxPurchasesPerCustomer:
      typeof meta.maxPurchasesPerCustomer === "number" ? meta.maxPurchasesPerCustomer : null,
    eligibleServiceIds: rules
      .filter((r) => r.bookingTypeId && r.label !== "Meeting")
      .map((r) => String(r.bookingTypeId)),
    eligibleMeetingIds: rules
      .filter((r) => r.bookingTypeId && r.label === "Meeting")
      .map((r) => String(r.bookingTypeId)),
    eligibleClassIds: rules
      .filter((r) => r.classSeriesId && r.label !== "Workshop")
      .map((r) => String(r.classSeriesId)),
    eligibleWorkshopIds: rules
      .filter((r) => r.classSeriesId && r.label === "Workshop")
      .map((r) => String(r.classSeriesId)),
    itemizedQuantities,
    imageUrl: typeof meta.imageUrl === "string" ? meta.imageUrl : "",
  };
}

export function buildCreditRules(form: PackageFormState): PackageCreditRule[] {
  const rules: PackageCreditRule[] = [];

  if (form.packageKind === "pooled") {
    if (form.totalCredits > 0) {
      rules.push({
        quantity: form.totalCredits,
        label: `${form.totalCredits} ${form.creditUnitLabel}`,
      });
    }
    for (const id of form.eligibleServiceIds) {
      rules.push({ bookingTypeId: id, quantity: 0, label: "Service" });
    }
    for (const id of form.eligibleMeetingIds) {
      rules.push({ bookingTypeId: id, quantity: 0, label: "Meeting" });
    }
    for (const id of form.eligibleClassIds) {
      rules.push({ classSeriesId: id, quantity: 0, label: "Class" });
    }
    for (const id of form.eligibleWorkshopIds) {
      rules.push({ classSeriesId: id, quantity: 0, label: "Workshop" });
    }
    return rules;
  }

  const pushItemized = (
    kind: "service" | "meeting" | "class" | "workshop",
    id: string,
    label: string,
    classSeriesId?: string,
    bookingTypeId?: string,
  ) => {
    const qty = form.itemizedQuantities[itemizedKey(kind, id)] ?? 1;
    if (qty <= 0) return;
    rules.push({
      quantity: qty,
      label,
      ...(bookingTypeId ? { bookingTypeId } : {}),
      ...(classSeriesId ? { classSeriesId } : {}),
    });
  };

  for (const id of form.eligibleServiceIds) {
    pushItemized("service", id, "Service", undefined, id);
  }
  for (const id of form.eligibleMeetingIds) {
    pushItemized("meeting", id, "Meeting", undefined, id);
  }
  for (const id of form.eligibleClassIds) {
    pushItemized("class", id, "Class", id);
  }
  for (const id of form.eligibleWorkshopIds) {
    pushItemized("workshop", id, "Workshop", id);
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
      packageKind: form.packageKind,
      sellTemplate: form.sellTemplate,
      creditUnitLabel: form.creditUnitLabel,
      expirationMode: form.expirationMode,
      expirationDate: form.expirationMode === "fixed" ? form.expirationDate : undefined,
      maxPurchasesPerCustomer: form.maxPurchasesPerCustomer || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
    },
  };
}

export function validatePackageForm(form: PackageFormState): string | null {
  if (!form.name.trim()) return "Package name is required";
  if (form.priceCents < 0) return "Price cannot be negative";

  const selectionCount =
    form.eligibleServiceIds.length +
    form.eligibleMeetingIds.length +
    form.eligibleClassIds.length +
    form.eligibleWorkshopIds.length;

  if (selectionCount === 0) return "Choose at least one thing customers can book with this package";

  if (form.packageKind === "pooled") {
    if (form.totalCredits < 1) return "A package must include at least one session or use";
  } else {
    const rules = buildCreditRules(form);
    if (!rules.some((r) => r.quantity > 0)) {
      return "Set how many of each included booking customers receive";
    }
  }

  if (form.expirationMode === "days" && form.expirationDays < 1) {
    return "Expiration must be at least one day";
  }
  if (form.expirationMode === "fixed" && !form.expirationDate) {
    return "Choose an expiration date";
  }
  return null;
}

export function applyPackageSellTemplate(
  template: PackageSellTemplate,
  prev: PackageFormState,
): PackageFormState {
  switch (template) {
    case "prepaid_sessions":
      return {
        ...prev,
        sellTemplate: template,
        packageKind: "pooled",
        creditUnitLabel: "tutoring sessions",
        totalCredits: prev.totalCredits < 1 ? 5 : prev.totalCredits,
      };
    case "bundle_classes":
      return {
        ...prev,
        sellTemplate: template,
        packageKind: "itemized",
        creditUnitLabel: "enrollments",
      };
    case "mixed_bundle":
      return {
        ...prev,
        sellTemplate: template,
        packageKind: "itemized",
        creditUnitLabel: "bookings",
      };
    case "custom":
    default:
      return { ...prev, sellTemplate: "custom" };
  }
}

export function eligibilitySummary(rules: PackageCreditRule[]): {
  services: number;
  meetings: number;
  classes: number;
  workshops: number;
  total: number;
} {
  const services = rules.filter((r) => r.bookingTypeId && r.label !== "Meeting").length;
  const meetings = rules.filter((r) => r.bookingTypeId && r.label === "Meeting").length;
  const classes = rules.filter((r) => r.classSeriesId && r.label !== "Workshop").length;
  const workshops = rules.filter((r) => r.classSeriesId && r.label === "Workshop").length;
  return { services, meetings, classes, workshops, total: services + meetings + classes + workshops };
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function packageGrantsOffering(
  rules: PackageCreditRule[],
  offering: { kind: "service" | "meeting" | "class" | "workshop"; id: string },
): boolean {
  if (offering.kind === "service") {
    return rules.some((r) => r.bookingTypeId === offering.id && r.label !== "Meeting");
  }
  if (offering.kind === "meeting") {
    return rules.some((r) => r.bookingTypeId === offering.id && r.label === "Meeting");
  }
  const label = offering.kind === "workshop" ? "Workshop" : "Class";
  return rules.some((r) => r.classSeriesId === offering.id && r.label === label);
}
