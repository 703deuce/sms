export type ProtectionMode = "standard" | "strict" | "off";

export type BookingAppointmentType = {
  id: string;
  name: string;
  duration: string;
  description: string;
};

export type SuspiciousBooking = {
  id: string;
  at: string;
  serviceName?: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  action: "challenge" | "block";
  signals: string[];
};

export const workspace = {
  slug: "riverside-dental",
  name: "Riverside Dental Studio",
};

export const bookingUrl = `https://app.transovo.com/book/${workspace.slug}`;

export const businessInfo = {
  displayName: "Riverside Dental Studio",
  timezone: "America/New_York",
  phone: "(571) 407-3615",
  address: "2140 Riverside Ave, Suite 300, Richmond, VA 23220",
};

export const DEFAULT_SMS_CONSENT_TEXT =
  "By checking this box, I agree to receive appointment-related text messages from Riverside Dental Studio at the mobile number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time.";

export const smsConsent = {
  wording: DEFAULT_SMS_CONSENT_TEXT,
  termsUrl: "/terms",
  privacyUrl: "/privacy",
};

export const protectionOptions: {
  id: ProtectionMode;
  name: string;
  description: string;
}[] = [
  {
    id: "standard",
    name: "Standard",
    description: "Challenge suspicious bookings with a confirmation step.",
  },
  {
    id: "strict",
    name: "Strict",
    description: "Block high-risk bookings and challenge medium risk.",
  },
  {
    id: "off",
    name: "Off",
    description: "Accept all bookings without risk screening.",
  },
];

export const suspiciousBookings: SuspiciousBooking[] = [
  {
    id: "sb_1",
    at: "Sep 12 · 3:41 PM",
    serviceName: "New Patient Exam",
    riskLevel: "HIGH",
    action: "block",
    signals: ["Disposable email domain", "5 bookings in 10 minutes"],
  },
  {
    id: "sb_2",
    at: "Sep 11 · 11:02 AM",
    serviceName: "Hygiene Cleaning",
    riskLevel: "MEDIUM",
    action: "challenge",
    signals: ["VPN detected"],
  },
];

export const appointmentTypes: BookingAppointmentType[] = [
  {
    id: "t1",
    name: "New Patient Exam",
    duration: "60 min",
    description: "Comprehensive exam, X-rays, and treatment planning.",
  },
  {
    id: "t2",
    name: "Hygiene Cleaning",
    duration: "45 min",
    description: "Routine cleaning with our hygiene team.",
  },
  {
    id: "t3",
    name: "Consultation",
    duration: "30 min",
    description: "Discuss treatment options with Dr. Alvarez.",
  },
];

export const whyBookItems = [
  {
    icon: "clock" as const,
    title: "Fast & easy",
    text: "Book in just a few clicks.",
  },
  {
    icon: "shield" as const,
    title: "Secure & private",
    text: "Your information is always protected.",
  },
  {
    icon: "message" as const,
    title: "SMS reminders",
    text: "Get timely reminders on your phone.",
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
];
