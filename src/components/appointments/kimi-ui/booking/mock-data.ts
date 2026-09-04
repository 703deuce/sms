export const bookingData = {
  publicUrl: "https://book.example.com",
  enabled: true,
};

export const businessInfo = {
  displayName: "Mass Texting Browser Cert",
  timezone: "America/New_York",
  phone: "(555) 123-4567",
  address: "123 Main St, City, ST 12345",
};

export const smsConsent = {
  wording:
    "I agree to receive appointment confirmations and reminders by SMS. Message and data rates may apply. Reply STOP to opt out.",
  termsUrl: "https://example.com/terms",
  privacyUrl: "https://example.com/privacy",
};

export const appointmentTypes = [
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
  {
    id: "support",
    name: "Support Call",
    duration: "30 min",
    description: "Get help with your account or a specific issue.",
  },
  {
    id: "followup",
    name: "Follow-up Call",
    duration: "15 min",
    description: "Quick check-in or follow-up discussion.",
  },
];

export const whyBookItems = [
  { icon: "clock", title: "Fast & Easy", text: "Book in just a few clicks." },
  {
    icon: "shield",
    title: "Secure & Private",
    text: "Your information is always protected.",
  },
  {
    icon: "message",
    title: "SMS Reminders",
    text: "Get timely reminders on your phone.",
  },
];

export const protectionLevels = [
  {
    id: "standard",
    name: "Standard",
    description: "Challenge suspicious bookings with a confirmation step.",
    selected: true,
  },
  {
    id: "strict",
    name: "Strict",
    description: "Block high-risk bookings and challenge medium risk.",
    selected: false,
  },
  {
    id: "off",
    name: "Off",
    description: "Accept all bookings without risk screening.",
    selected: false,
  },
];
