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
