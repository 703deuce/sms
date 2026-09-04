import type { BookingPageModel } from "@/features/appointments/kimi/booking/types";

export const mockBookingPageModel: BookingPageModel = {
  workspaceName: "Mass Texting Browser Cert",
  workspaceSlug: "mass-text-cert",
  bookingUrl: "https://book.example.com/mass-text-cert",
  bookingPath: "/book/mass-text-cert",
  hasSlug: true,
  bookingEnabled: true,
  businessInfo: {
    displayName: "Mass Texting Browser Cert",
    timezone: "America/New_York",
    phone: "(555) 123-4567",
    address: "123 Main St, City, ST 12345",
  },
  smsConsent: {
    wording:
      "I agree to receive appointment confirmations and reminders by SMS. Message and data rates may apply. Reply STOP to opt out.",
    termsUrl: "https://example.com/terms",
    privacyUrl: "https://example.com/privacy",
  },
  protectionMode: "standard",
  protectionOptions: [
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
  ],
  suspiciousBookings: [],
  appointmentTypes: [
    {
      id: "consultation",
      name: "Consultation",
      duration: "30 min",
      description: "Discuss your needs and find the right solution.",
    },
    {
      id: "setup",
      name: "Setup & Onboarding",
      duration: "60 min",
      description: "Get set up and launched with our platform.",
    },
  ],
  whyBookItems: [
    { icon: "clock", title: "Fast & Easy", text: "Book in just a few clicks." },
    { icon: "shield", title: "Secure & Private", text: "Your information is always protected." },
    { icon: "message", title: "SMS Reminders", text: "Get timely reminders on your phone." },
  ],
};
