export type MessagingRegistrationView = {
  status: "approved" | "pending" | "rejected";
  brandName: string;
  useCase: string;
  useCaseDescription: string;
  optInDescription: string;
  messageVolume: string;
  vertical: string;
  submittedAt: string;
  approvedAt: string;
  sampleMessages: string[];
  helpMessage: string;
  stopMessage: string;
  consentText: string;
  termsVersion: string;
  consentCapturedAt: string;
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

export const timezones = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
];

export type MessagingRuntimeView = {
  awayEnabled: boolean;
  awayAlways: boolean;
  awayMessage: string;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  reviewLinkUrl: string;
  optOutKeywords: string[] | string | null;
  optInKeywords: string[] | string | null;
  helpKeywords: string[] | string | null;
};

export const registration: MessagingRegistrationView = {
  status: "approved" as const,
  brandName: "Bright Dental Studio",
  useCase: "Customer care",
  useCaseDescription:
    "SMS notifications and customer support messages for subscribers who opted in.",
  optInDescription: "Subscribers opt in via web form, keyword, or written consent.",
  messageVolume: "1,000 – 5,000 / month",
  vertical: "Healthcare",
  submittedAt: "Sep 5, 2026",
  approvedAt: "Sep 7, 2026",
  sampleMessages: [
    "Hi {{first_name}}, this is Bright Dental Studio confirming your appointment on {{appointment_date}} at {{appointment_time}}. Reply YES to confirm or C to cancel.",
    "Reminder: your appointment with Bright Dental Studio is tomorrow at {{appointment_time}}. Reply STOP to opt out.",
  ],
  helpMessage:
    "Bright Dental Studio: For help, call (571) 555-0142 or email frontdesk@brightdental.example. Reply STOP to opt out. Msg&data rates may apply.",
  stopMessage:
    "You have been unsubscribed from Bright Dental Studio messages and will receive no further texts. Reply START to resubscribe.",
  consentText:
    "I agree to receive appointment confirmations and reminders by SMS from Bright Dental Studio. Reply STOP to opt out at any time. Msg&data rates may apply. Terms & Privacy Policy apply.",
  termsVersion: "3",
  consentCapturedAt: "Aug 21, 2026",
};

export const runtime: MessagingRuntimeView = {
  awayEnabled: true,
  awayAlways: false,
  awayMessage:
    "Thanks for texting Bright Dental Studio. We're currently away and will reply during business hours (Mon–Fri, 9am–5pm ET). For urgent needs, call (571) 555-0142.",
  timezone: "America/New_York",
  quietHoursStart: "21:00",
  quietHoursEnd: "08:00",
  reviewLinkUrl: "https://reviews.example.com/bright-dental",
  optOutKeywords: ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"],
  optInKeywords: ["START", "YES", "UNSTOP"],
  helpKeywords: ["HELP", "INFO"],
};
