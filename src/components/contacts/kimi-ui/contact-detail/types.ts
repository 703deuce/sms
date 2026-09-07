export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  company: string | null;
  status: "Active" | "Unsubscribed" | "Blocked" | "Invalid";
  tags: string[];
  timezone: string | null;
  linkedin: string | null;
  consentDate: string | null;
  consentSource: string | null;
  dateAdded: string;
  lastReply: string | null;
  lastMessaged: string | null;
};

export const contact: Contact = {
  id: "ct_01HZX4A8M2",
  firstName: "Sarah",
  lastName: "Johnson",
  phone: "+15714073615",
  email: "sarah.johnson@brookside.com",
  company: "Brookside Dental",
  status: "Active",
  tags: ["VIP", "Recall – 6mo"],
  timezone: "America/New_York",
  linkedin: "https://linkedin.com/in/sarahjohnson",
  consentDate: "2024-09-02T14:03:00Z",
  consentSource: "Booking page",
  dateAdded: "2024-08-28T11:22:00Z",
  lastReply: "2024-10-04T15:41:00Z",
  lastMessaged: "2024-10-05T09:00:00Z",
};

export type Appointment = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  status: string;
  isUpcoming: boolean;
};

export const upcomingAppointments: Appointment[] = [
  {
    id: "ap_1001",
    serviceName: "Water Heater Estimate",
    startsAt: "2024-10-12T18:00:00Z",
    status: "confirmed",
    isUpcoming: true,
  },
  {
    id: "ap_1002",
    serviceName: "Follow-up Consultation",
    startsAt: "2024-10-24T14:30:00Z",
    status: "awaiting_confirmation",
    isUpcoming: true,
  },
];

export const pastAppointments: Appointment[] = [
  {
    id: "ap_0994",
    serviceName: "Initial Consultation",
    startsAt: "2024-09-10T18:00:00Z",
    status: "completed",
    isUpcoming: false,
  },
  {
    id: "ap_0971",
    serviceName: "Site Inspection",
    startsAt: "2024-08-22T15:00:00Z",
    status: "completed",
    isUpcoming: false,
  },
  {
    id: "ap_0940",
    serviceName: "Estimate Review",
    startsAt: "2024-08-02T16:00:00Z",
    status: "no_show",
    isUpcoming: false,
  },
];

export type TimelineItem = {
  id: string;
  kind: "sms" | "call" | "voice_ai" | "voicemail" | "voice_reminder";
  direction?: string | null;
  summary: string;
  status?: string | null;
  at: string;
  href?: string | null;
  crmSync?: { provider: string; externalUrl: string | null; syncStatus: string }[];
};

export const timeline: TimelineItem[] = [
  {
    id: "tl_9",
    kind: "sms",
    direction: "outbound",
    summary: "Reminder: Your Water Heater Estimate is tomorrow at 2:00 PM. Reply YES to confirm.",
    status: "Delivered",
    at: "2024-10-05T09:00:00Z",
    crmSync: [{ provider: "salesforce", externalUrl: "#", syncStatus: "synced" }],
  },
  {
    id: "tl_8",
    kind: "sms",
    direction: "inbound",
    summary: "YES — confirmed, see you tomorrow.",
    status: null,
    at: "2024-10-04T15:41:00Z",
  },
  {
    id: "tl_7",
    kind: "call",
    direction: "outbound",
    summary: "Outbound call — 4m 12s. Discussed estimate details and parking instructions.",
    status: "Completed",
    at: "2024-09-30T17:22:00Z",
  },
  {
    id: "tl_6",
    kind: "sms",
    direction: "outbound",
    summary: "Booking confirmation: Water Heater Estimate on Thu, Oct 12 at 2:00 PM.",
    status: "Delivered",
    at: "2024-09-10T18:05:00Z",
    crmSync: [{ provider: "salesforce", externalUrl: "#", syncStatus: "synced" }],
  },
  {
    id: "tl_5",
    kind: "voicemail",
    direction: "inbound",
    summary: "Voicemail received — 0m 38s. “Hi, this is Sarah, calling to confirm my address…”",
    status: null,
    at: "2024-09-08T20:14:00Z",
  },
];

export type CrmLink = {
  id: string;
  provider: string;
  displayName: string;
  objectType: string;
  name: string | null;
  externalUrl: string | null;
  owner: string | null;
  stage: string | null;
  dealValue: number | null;
  currency: string | null;
  syncStatus: string;
  pendingSync: boolean;
  syncFailure: boolean;
  conflict: boolean;
  lastSyncedAt: string | null;
};

export const crmLinks: CrmLink[] = [
  {
    id: "lnk_1",
    provider: "salesforce",
    displayName: "Salesforce",
    objectType: "deal",
    name: "Brookside Dental — Water Heater Replacement",
    externalUrl: "#",
    owner: "Dana Cole",
    stage: "Proposal Sent",
    dealValue: 4200,
    currency: "USD",
    syncStatus: "synced",
    pendingSync: false,
    syncFailure: false,
    conflict: false,
    lastSyncedAt: "2024-10-05T09:04:00Z",
  },
  {
    id: "lnk_2",
    provider: "calendly",
    displayName: "Calendly",
    objectType: "event",
    name: "Follow-up Consultation",
    externalUrl: "#",
    owner: null,
    stage: null,
    dealValue: null,
    currency: null,
    syncStatus: "synced",
    pendingSync: false,
    syncFailure: false,
    conflict: false,
    lastSyncedAt: "2024-10-04T15:40:00Z",
  },
];

export const bookingUrl = "https://book.transovo.io/brookside";
