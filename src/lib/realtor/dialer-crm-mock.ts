/** Fixture data for Dialer and Phone Settings pages. */

export const DIALER_LINE = "+1 (231) 345-7880";

export const ACTIVE_CALL = {
  name: "Julia Smith",
  initials: "JS",
  since: "Lead since July 14, 2024",
  location: "Miami, FL, US",
  badge: "Lead",
};

export const RECENT_CONTACTS = [
  { name: "John Doe", initials: "JD", type: "call" as const },
  { name: "Jane Watson", initials: "JW", type: "sms" as const },
  { name: "Steve Doe", initials: "SD", type: "call" as const },
  { name: "Maria Williams", initials: "MW", type: "missed" as const },
  { name: "Tod Doe", initials: "TD", type: "call" as const },
];

export const RECENT_DELIVERIES = [
  { type: "Outbound Call", contact: "Doe John", time: "7:34 am", duration: "2 min", direction: "outbound" as const },
  { type: "Inbound Call", contact: "Jane Watson", time: "8:54 am", duration: "1 min", direction: "inbound" as const },
  { type: "Outbound Call", contact: "Steve Doe", time: "9:15 am", duration: "3 min", direction: "outbound" as const },
  { type: "Missed Call", contact: "Maria Williams", time: "10:15 am", duration: "—", direction: "missed" as const },
];

export const RECENT_CALLS = [
  { id: "rc1", contact: "John Doe", phone: "(703) 555-0101", time: "Today, 10:15 AM", duration: "3:42", direction: "outbound" as const, status: "Completed" },
  { id: "rc2", contact: "Jane Watson", phone: "(703) 555-0202", time: "Today, 9:30 AM", duration: "1:18", direction: "inbound" as const, status: "Completed" },
  { id: "rc3", contact: "Steve Doe", phone: "(703) 555-0303", time: "Yesterday, 4:45 PM", duration: "5:02", direction: "outbound" as const, status: "Completed" },
  { id: "rc4", contact: "Maria Williams", phone: "(703) 555-0404", time: "Yesterday, 2:20 PM", duration: "—", direction: "missed" as const, status: "Missed" },
  { id: "rc5", contact: "Robert Chen", phone: "(703) 555-0505", time: "May 17, 3:00 PM", duration: "2:55", direction: "inbound" as const, status: "Completed" },
];

export const DIALER_NUMBERS = [
  { id: "n1", number: "(571) 555-0198", label: "Main Office Line", type: "Local", default: true },
  { id: "n2", number: "(703) 555-0142", label: "Speed-to-Lead", type: "Local", default: false },
  { id: "n3", number: "(571) 555-0287", label: "Front Desk AI", type: "Toll-Free", default: false },
];

export const VOICEMAIL_PREVIEW = {
  from: "John Doe",
  duration: "0:34",
  current: "0:00",
};

export const PHONE_SETTINGS_SECTIONS = [
  { id: "general", label: "General", description: "Manage basic phone preferences" },
  { id: "call-handling", label: "Call Handling", description: "Coming soon — stay tuned!" },
  { id: "voicemail", label: "Voicemail", description: "Personalize your voicemail greeting" },
  { id: "sms", label: "SMS/Reviews", description: "Set up auto-responses for SMS" },
  { id: "display", label: "Dialer Display", description: "Manage caller ID and name" },
  { id: "devices", label: "Call & Devices", description: "Select and manage your devices" },
  { id: "ringtone", label: "Ringtone", description: "Choose your favorite melody" },
  { id: "advanced", label: "Advanced", description: "Advanced settings and troubleshooting" },
];

export const SHORT_TAGS = [
  "Call is for house for sale",
  "Not interested right now",
  "Needs a listing",
  "Scheduled follow-up",
];
