import type { MembershipBenefits } from "@/lib/appointments/service-booking/types";

export type MembershipBenefitType = "member_access";

export type MembershipFormState = {
  name: string;
  description: string;
  priceCents: number;
  billingInterval: "month" | "quarter" | "year" | string;
  active: boolean;
  purchaseAvailability: "public" | "hidden" | "booking_only";
  cancelPolicy: "period_end" | "immediate";
  benefitType: MembershipBenefitType;
  eligibleServiceIds: string[];
  eligibleMeetingIds: string[];
  eligibleClassIds: string[];
  eligibleWorkshopIds: string[];
  imageUrl: string;
};

export const EMPTY_MEMBERSHIP_FORM: MembershipFormState = {
  name: "",
  description: "",
  priceCents: 0,
  billingInterval: "month",
  active: true,
  purchaseAvailability: "public",
  cancelPolicy: "period_end",
  benefitType: "member_access",
  eligibleServiceIds: [],
  eligibleMeetingIds: [],
  eligibleClassIds: [],
  eligibleWorkshopIds: [],
  imageUrl: "",
};

export type MembershipProductApiRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  billingInterval: string;
  benefits: MembershipBenefits | unknown;
  stripePriceId?: string | null;
  active: boolean;
  metadata?: {
    purchaseAvailability?: string;
    cancelPolicy?: string;
    imageUrl?: string;
  } | null;
  activeMemberCount?: number;
  pastDueCount?: number;
};

export function buildMembershipBenefits(form: MembershipFormState): MembershipBenefits {
  return {
    memberOnlyTypeIds: [...form.eligibleServiceIds, ...form.eligibleMeetingIds],
    memberOnlyClassSeriesIds: [...form.eligibleClassIds, ...form.eligibleWorkshopIds],
  };
}

export function membershipFormFromRow(row: MembershipProductApiRow): MembershipFormState {
  const benefits = (row.benefits || {}) as MembershipBenefits;
  const meta = (row.metadata || {}) as MembershipFormState & Record<string, unknown>;
  const typeIds = benefits.memberOnlyTypeIds || [];
  const classIds = benefits.memberOnlyClassSeriesIds || [];
  return {
    name: row.name,
    description: row.description || "",
    priceCents: row.priceCents,
    billingInterval: row.billingInterval || "month",
    active: row.active,
    purchaseAvailability:
      meta.purchaseAvailability === "hidden"
        ? "hidden"
        : meta.purchaseAvailability === "booking_only"
          ? "booking_only"
          : "public",
    cancelPolicy: meta.cancelPolicy === "immediate" ? "immediate" : "period_end",
    benefitType: "member_access",
    eligibleServiceIds: typeIds,
    eligibleMeetingIds: [],
    eligibleClassIds: classIds,
    eligibleWorkshopIds: [],
    imageUrl: typeof meta.imageUrl === "string" ? meta.imageUrl : "",
  };
}

/** Split stored type IDs using offering kind hints when available. */
export function membershipFormFromRowWithOfferings(
  row: MembershipProductApiRow,
  offeringKinds: Map<string, "service" | "meeting" | "class" | "workshop">,
): MembershipFormState {
  const base = membershipFormFromRow(row);
  const benefits = (row.benefits || {}) as MembershipBenefits;
  const typeIds = benefits.memberOnlyTypeIds || [];
  const classIds = benefits.memberOnlyClassSeriesIds || [];
  const eligibleServiceIds: string[] = [];
  const eligibleMeetingIds: string[] = [];
  for (const id of typeIds) {
    const kind = offeringKinds.get(id);
    if (kind === "meeting") eligibleMeetingIds.push(id);
    else eligibleServiceIds.push(id);
  }
  const eligibleClassIds: string[] = [];
  const eligibleWorkshopIds: string[] = [];
  for (const id of classIds) {
    const kind = offeringKinds.get(id);
    if (kind === "workshop") eligibleWorkshopIds.push(id);
    else eligibleClassIds.push(id);
  }
  return {
    ...base,
    eligibleServiceIds,
    eligibleMeetingIds,
    eligibleClassIds,
    eligibleWorkshopIds,
  };
}

export function membershipSavePayload(form: MembershipFormState, id?: string) {
  return {
    id,
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    priceCents: form.priceCents,
    billingInterval: form.billingInterval,
    benefits: buildMembershipBenefits(form),
    active: form.active,
    metadata: {
      purchaseAvailability: form.purchaseAvailability,
      cancelPolicy: form.cancelPolicy,
      imageUrl: form.imageUrl.trim() || undefined,
    },
  };
}

export function validateMembershipForm(form: MembershipFormState): string | null {
  if (!form.name.trim()) return "Membership name is required";
  if (form.priceCents < 0) return "Price cannot be negative";
  if (!form.billingInterval.trim()) return "Billing interval is required";
  const total =
    form.eligibleServiceIds.length +
    form.eligibleMeetingIds.length +
    form.eligibleClassIds.length +
    form.eligibleWorkshopIds.length;
  if (total === 0) return "Choose at least one eligible booking";
  return null;
}

export function accessSummary(form: MembershipFormState): {
  services: number;
  meetings: number;
  classes: number;
  workshops: number;
  total: number;
  label: string;
} {
  const services = form.eligibleServiceIds.length;
  const meetings = form.eligibleMeetingIds.length;
  const classes = form.eligibleClassIds.length;
  const workshops = form.eligibleWorkshopIds.length;
  const parts: string[] = [];
  if (services) parts.push(`${services} Service${services === 1 ? "" : "s"}`);
  if (meetings) parts.push(`${meetings} Meeting${meetings === 1 ? "" : "s"}`);
  if (classes) parts.push(`${classes} Class${classes === 1 ? "" : "es"}`);
  if (workshops) parts.push(`${workshops} Workshop${workshops === 1 ? "" : "s"}`);
  return {
    services,
    meetings,
    classes,
    workshops,
    total: services + meetings + classes + workshops,
    label: parts.length ? parts.join(" · ") : "None yet",
  };
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function formatBillingInterval(interval: string): string {
  const map: Record<string, string> = {
    month: "Monthly",
    monthly: "Monthly",
    quarter: "Quarterly",
    quarterly: "Quarterly",
    year: "Annual",
    annual: "Annual",
    yearly: "Annual",
  };
  return map[interval.toLowerCase()] || interval;
}

export function accessLabelFromBenefits(benefits: MembershipBenefits): string {
  const services = (benefits.memberOnlyTypeIds || []).length;
  const classes = (benefits.memberOnlyClassSeriesIds || []).length;
  const parts: string[] = [];
  if (services) parts.push(`${services} Service${services === 1 ? "" : "s"}`);
  if (classes) parts.push(`${classes} Class${classes === 1 ? "" : "es"}`);
  return parts.length ? parts.join(" · ") : "None yet";
}

export function membershipGrantsOffering(
  benefits: MembershipBenefits,
  offering: { kind: "service" | "meeting" | "class" | "workshop"; id: string },
): boolean {
  if (offering.kind === "service" || offering.kind === "meeting") {
    return (benefits.memberOnlyTypeIds || []).includes(offering.id);
  }
  return (benefits.memberOnlyClassSeriesIds || []).includes(offering.id);
}
