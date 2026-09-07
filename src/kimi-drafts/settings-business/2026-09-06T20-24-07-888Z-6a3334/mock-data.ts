export const mockWorkspace = {
  id: "ws_01HXYZ",
  name: "Brightline Dental Studio",
  timezone: "America/New_York",
};

export const mockRegistration = {
  legalBusinessName: "Brightline Dental Studio LLC",
  dbaName: "Brightline Dental",
  businessType: "llc",
  businessIndustry: "healthcare",
  businessRegistrationId: "88-4210376",
  websiteUrl: "https://brightlinedental.com",
  street: "2140 Clinton Ave S",
  city: "Rochester",
  region: "NY",
  postalCode: "14618",
  country: "US",
  contactFirstName: "Maya",
  contactLastName: "Chen",
  contactEmail: "frontdesk@brightlinedental.com",
  contactPhone: "+1 (585) 555-0142",
  brandStatus: "approved" as "approved" | "pending" | "rejected",
  campaignStatus: "approved" as "approved" | "pending" | "rejected",
  updatedAt: "2026-09-04T14:22:00Z",
};

export const settingsTabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Team", href: "/settings/users" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Calendar", href: "/settings/calendar" },
  { label: "Meetings", href: "/settings/ai-notetaker" },
  { label: "Security", href: "/settings/security" },
  { label: "Billing", href: "/settings/billing" },
];

export const sidebarNav = [
  { label: "Home", icon: "home", href: "/appointments/overview" },
  { label: "Appointments", icon: "calendar", href: "/appointments" },
  { label: "Booking", icon: "book", href: "/appointments/types" },
  { label: "Contacts", icon: "users", href: "/contacts" },
  { label: "Messages", icon: "message", href: "/conversations", badge: 3 },
  { label: "Automations", icon: "zap", href: "/appointments/workflows" },
  { label: "Meetings", icon: "video", href: "/video" },
  { label: "Payments", icon: "card", href: "/payments/transactions" },
  { label: "Analytics", icon: "chart", href: "/appointments/analytics" },
  { label: "Integrations", icon: "plug", href: "/integrations/calendars" },
  { label: "Settings", icon: "gear", href: "/settings/business" },
];

export const DEFAULT_SMS_CONSENT_TEXT =
  "By checking this box, I agree to receive appointment-related text messages from Brightline Dental Studio at the mobile number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time.";

export const suspiciousBookings = [
  {
    id: "sb_1",
    at: "Sep 5, 2:14 PM",
    serviceName: "New Patient Exam",
    riskLevel: "HIGH" as const,
    action: "block" as const,
    signals: ["disposable email", "velocity limit"],
  },
  {
    id: "sb_2",
    at: "Sep 4, 9:42 AM",
    serviceName: "Consultation",
    riskLevel: "MEDIUM" as const,
    action: "challenge" as const,
    signals: ["suspicious notes"],
  },
];

export const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Australia/Sydney",
];
