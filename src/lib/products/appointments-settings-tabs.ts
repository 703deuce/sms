/** Appointments product — settings subnav (organization-wide configuration). */
export const appointmentsSettingsTabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Team", href: "/settings/users" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Calendar", href: "/settings/calendar" },
  { label: "Meetings", href: "/settings/ai-notetaker" },
  { label: "Security", href: "/settings/security" },
  { label: "Billing", href: "/settings/billing" },
];

/** Appointments product — integrations subnav (external system connections). */
export const appointmentsIntegrationsTabs = [
  { label: "Calendars", href: "/integrations/calendars" },
  { label: "Payments", href: "/integrations/payments" },
];

/** Appointments product — analytics subnav. */
export const appointmentsAnalyticsTabs = [
  { label: "Overview", href: "/appointments/analytics" },
  { label: "Booking", href: "/appointments/analytics/booking" },
  { label: "Reminders", href: "/appointments/analytics/reminders" },
  { label: "Automations", href: "/appointments/analytics/automations" },
  { label: "Reports", href: "/appointments/analytics/reports" },
];

export type AppointmentsAnalyticsSection =
  | "overview"
  | "booking"
  | "reminders"
  | "automations"
  | "reports";
