/**
 * Batch 8G-1 — canonical destinations for retired Appointments temp/legacy routes.
 * Source of truth: docs/APPOINTMENTS-FINAL-ROUTE-RETIREMENT-MAP.md
 */

export type SearchParamsInput = Record<string, string | string[] | undefined> | undefined;

/** Commerce / service-booking hub section= deep links */
export const COMMERCE_SECTION_REDIRECTS: Record<string, string> = {
  packages: "/appointments/packages",
  memberships: "/appointments/memberships",
  gifts: "/appointments/gift-cards",
  coupons: "/appointments/discounts",
  addons: "/appointments/types",
  products: "/appointments/pos",
  resources: "/appointments/booking/rooms-equipment",
  classes: "/appointments/types/classes",
  intake: "/appointments/booking/forms",
  theme: "/appointments/booking?section=branding",
  reports: "/appointments/analytics/reports?report=service-booking",
  webhooks: "/integrations/developer",
  invoices: "/payments/invoices",
  dynamicPricing: "/appointments/types/services",
};

/** Routes retired in 8G-1 with static (non-section) destinations */
export const STATIC_LEGACY_REDIRECTS: Record<string, string> = {
  "/appointments/booking/branding": "/appointments/booking?section=branding",
  "/appointments/booking/contracts": "/appointments/booking/forms",
  "/appointments/booking/share": "/appointments/booking?section=share",
  "/appointments/categories": "/appointments/types",
  "/appointments/classes": "/appointments/types/classes",
  "/appointments/client-restrictions": "/contacts",
  "/appointments/commerce/contact-merge": "/contacts",
  "/appointments/contracts": "/appointments/booking/forms",
  "/appointments/coupons": "/appointments/discounts",
  "/appointments/no-show-recovery": "/appointments/automations/no-show",
  "/appointments/policies": "/settings/business#booking-policies",
  "/appointments/recall-campaigns": "/appointments/automations/recall",
  "/appointments/reports/service-booking": "/appointments/analytics/reports?report=service-booking",
  "/appointments/resources": "/appointments/booking/rooms-equipment",
  "/appointments/restrictions": "/contacts",
  "/appointments/routing": "/appointments/routing-forms",
  "/appointments/scheduled": "/appointments",
  "/appointments/segments": "/contacts/segments",
  "/appointments/service-booking": "/appointments/types/services",
  "/appointments/voice-reminders": "/appointments/reminders",
};

export const RETIRED_APPOINTMENTS_ROUTES = Object.keys(STATIC_LEGACY_REDIRECTS).concat([
  "/appointments/commerce",
]);

function getParam(searchParams: SearchParamsInput, key: string): string | undefined {
  const raw = searchParams?.[key];
  if (Array.isArray(raw)) return raw[0];
  return raw ?? undefined;
}

function appendQuery(base: string, params: Record<string, string>): string {
  const [path, existing] = base.split("?");
  const merged = new URLSearchParams(existing || "");
  for (const [k, v] of Object.entries(params)) {
    if (v) merged.set(k, v);
  }
  const q = merged.toString();
  return q ? `${path}?${q}` : path;
}

/**
 * Resolve a retired Appointments admin route to its canonical destination.
 * Preserves meaningful query parameters where supported.
 */
export function resolveLegacyAppointmentsRedirect(
  pathname: string,
  searchParams?: SearchParamsInput,
): string {
  const normalized = pathname.replace(/\/$/, "") || "/";

  if (normalized === "/appointments/commerce" || normalized === "/appointments/service-booking") {
    const section =
      getParam(searchParams, "section") ||
      getParam(searchParams, "tab") ||
      (normalized === "/appointments/service-booking" ? "dynamicPricing" : undefined);
    if (section && COMMERCE_SECTION_REDIRECTS[section]) {
      return COMMERCE_SECTION_REDIRECTS[section];
    }
    return normalized === "/appointments/commerce"
      ? "/appointments/packages"
      : "/appointments/types/services";
  }

  if (normalized === "/appointments/reports/service-booking") {
    const params: Record<string, string> = { report: "service-booking" };
    const from = getParam(searchParams, "from");
    const to = getParam(searchParams, "to");
    const status = getParam(searchParams, "status");
    if (from) params.from = from;
    if (to) params.to = to;
    if (status) params.status = status;
    return appendQuery("/appointments/analytics/reports", params);
  }

  if (normalized === "/appointments/commerce/contact-merge") {
    const source =
      getParam(searchParams, "sourceContactId") || getParam(searchParams, "source");
    const target =
      getParam(searchParams, "targetContactId") || getParam(searchParams, "target");
    if (source && target) {
      return `/contacts?merge=1&source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`;
    }
    return "/contacts";
  }

  if (normalized === "/appointments/classes") {
    const id = getParam(searchParams, "id") || getParam(searchParams, "classId");
    if (id) {
      return `/appointments/types/classes?selected=${encodeURIComponent(id)}`;
    }
  }

  if (
    normalized === "/appointments/contracts" ||
    normalized === "/appointments/booking/contracts"
  ) {
    const id = getParam(searchParams, "id") || getParam(searchParams, "contractId");
    if (id) {
      return `/appointments/booking/forms?contract=${encodeURIComponent(id)}`;
    }
    return "/appointments/booking/forms";
  }

  if (normalized === "/appointments/policies") {
    const typeId =
      getParam(searchParams, "typeId") ||
      getParam(searchParams, "serviceId") ||
      getParam(searchParams, "classId");
    if (typeId) {
      return `/appointments/types/${encodeURIComponent(typeId)}?section=policies`;
    }
    return "/settings/business#booking-policies";
  }

  if (normalized === "/appointments/client-restrictions" || normalized === "/appointments/restrictions") {
    const contactId = getParam(searchParams, "contactId") || getParam(searchParams, "id");
    if (contactId) {
      return `/contacts/${encodeURIComponent(contactId)}?section=booking-access`;
    }
    return "/contacts";
  }

  if (normalized === "/appointments/segments") {
    const view = getParam(searchParams, "view");
    if (view === "recall" || view === "recalls") {
      return "/appointments/recalls";
    }
    return "/contacts/segments";
  }

  if (normalized === "/appointments/resources") {
    const id = getParam(searchParams, "id") || getParam(searchParams, "resourceId");
    if (id) {
      return `/appointments/booking/rooms-equipment?resource=${encodeURIComponent(id)}`;
    }
  }

  return STATIC_LEGACY_REDIRECTS[normalized] ?? normalized;
}
