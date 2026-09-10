/**
 * Post–8G-1 canonical Appointments admin routes for browser certification.
 * Legacy retired paths must only appear in route-redirect tests.
 */
export const APPT_CANONICAL = {
  packages: "/appointments/packages",
  memberships: "/appointments/memberships",
  giftCards: "/appointments/gift-cards",
  discounts: "/appointments/discounts",
  intakeForms: "/appointments/booking/forms",
  contracts: "/appointments/booking/forms",
  roomsEquipment: "/appointments/booking/rooms-equipment",
  classes: "/appointments/types/classes",
  events: "/appointments/types/events",
  types: "/appointments/types",
  booking: "/appointments/booking",
  share: "/appointments/booking?section=share",
  branding: "/appointments/booking?section=branding",
  serviceBookingReport: "/appointments/analytics/reports?report=service-booking",
  policies: "/settings/business",
  segments: "/contacts/segments",
  routingForms: "/appointments/routing-forms",
  scheduled: "/appointments",
  contacts: "/contacts",
  pos: "/appointments/pos",
  payments: "/appointments/payments",
  webhooks: "/integrations/developer",
  reminders: "/appointments/reminders",
  recalls: "/appointments/recalls",
  calendar: "/appointments/calendar",
  overview: "/appointments/overview",
  availability: "/appointments/availability",
  locations: "/appointments/locations",
  staff: "/appointments/staff",
  waitlist: "/appointments/waitlist",
  polls: "/appointments/polls",
  /** Legacy service-booking hub redirects here; dedicated /types/services page may not exist. */
  serviceHub: "/appointments/types",
} as const;

/** Representative retired URLs — full list in appointments-legacy-redirects.ts */
export const APPT_LEGACY_REDIRECT_SAMPLES: Array<{ from: string; expectPath: string }> = [
  { from: "/appointments/commerce", expectPath: "/appointments/packages" },
  { from: "/appointments/policies", expectPath: "/settings/business" },
  {
    from: "/appointments/reports/service-booking",
    expectPath: "/appointments/analytics/reports",
  },
  { from: "/appointments/routing", expectPath: "/appointments/routing-forms" },
  { from: "/appointments/classes", expectPath: "/appointments/types/classes" },
  { from: "/appointments/resources", expectPath: "/appointments/booking/rooms-equipment" },
  { from: "/appointments/contracts", expectPath: "/appointments/booking/forms" },
  { from: "/appointments/booking/share", expectPath: "/appointments/booking" },
  { from: "/appointments/booking/branding", expectPath: "/appointments/booking" },
  { from: "/appointments/scheduled", expectPath: "/appointments" },
  { from: "/appointments/restrictions", expectPath: "/contacts" },
  { from: "/appointments/segments", expectPath: "/contacts/segments" },
  { from: "/appointments/coupons", expectPath: "/appointments/discounts" },
  { from: "/appointments/categories", expectPath: "/appointments/types" },
  { from: "/appointments/service-booking", expectPath: "/appointments/types" },
];
