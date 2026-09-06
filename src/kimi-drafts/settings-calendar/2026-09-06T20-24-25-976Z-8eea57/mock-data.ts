export type ProviderCalendar = { id: string; name: string; primary?: boolean };

export type CalendarConnection = {
  id: string;
  provider: "google" | "microsoft";
  name: string;
  status: "connected" | "pending" | "needs_reauth";
  lastSyncAt?: string | null;
  config?: {
    writeCalendarId?: string;
    blockingCalendarIds?: string[];
    importCalendarIds?: string[];
    syncEnabled?: boolean;
    email?: string;
    importRules?: {
      requireExternalAttendees?: boolean;
      requireAttendeeEmail?: boolean;
      skipAllDay?: boolean;
      titleIncludePatterns?: string[];
      titleExcludePatterns?: string[];
    };
    reminderDefaults?: {
      smsEnabled?: boolean;
      emailEnabled?: boolean;
      voiceEnabled?: boolean;
      replyDestinationPhone?: string;
      replyDestinationEmail?: string;
      attachIcs?: boolean;
    };
    lastVerifiedAt?: string;
    lastVerificationOk?: boolean;
    lastVerificationError?: string | null;
    microsoftSubscription?: { expiresAt?: string };
  } | null;
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

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60000).toISOString();
const daysAhead = (d: number) => new Date(now + d * 86400000).toISOString();

export const mockConnections: CalendarConnection[] = [
  {
    id: "conn_ms_1",
    provider: "microsoft",
    name: "Microsoft 365 — Work",
    status: "connected",
    lastSyncAt: minsAgo(3),
    config: {
      writeCalendarId: "cal_ms_primary",
      blockingCalendarIds: ["cal_ms_primary", "cal_ms_team"],
      importCalendarIds: ["cal_ms_primary"],
      syncEnabled: true,
      email: "ops@brightlinestudio.com",
      importRules: {
        requireExternalAttendees: true,
        requireAttendeeEmail: false,
        skipAllDay: true,
        titleIncludePatterns: [],
        titleExcludePatterns: ["Lunch", "Personal"],
      },
      reminderDefaults: {
        smsEnabled: true,
        emailEnabled: true,
        voiceEnabled: false,
        replyDestinationPhone: "+1 (571) 555-0142",
        replyDestinationEmail: "frontdesk@brightlinestudio.com",
        attachIcs: true,
      },
      lastVerifiedAt: minsAgo(5),
      lastVerificationOk: true,
      lastVerificationError: null,
      microsoftSubscription: { expiresAt: daysAhead(3) },
    },
  },
  {
    id: "conn_g_1",
    provider: "google",
    name: "Google Calendar — Front Desk",
    status: "connected",
    lastSyncAt: minsAgo(96),
    config: {
      writeCalendarId: "cal_g_primary",
      blockingCalendarIds: ["cal_g_primary"],
      importCalendarIds: [],
      syncEnabled: true,
      email: "frontdesk@brightlinestudio.com",
      importRules: {
        requireExternalAttendees: true,
        requireAttendeeEmail: true,
        skipAllDay: true,
        titleIncludePatterns: [],
        titleExcludePatterns: [],
      },
      reminderDefaults: {
        smsEnabled: true,
        emailEnabled: false,
        voiceEnabled: false,
        replyDestinationPhone: "",
        replyDestinationEmail: "frontdesk@brightlinestudio.com",
        attachIcs: false,
      },
      lastVerifiedAt: minsAgo(1300),
      lastVerificationOk: true,
      lastVerificationError: null,
    },
  },
  {
    id: "conn_g_2",
    provider: "google",
    name: "Google Calendar — Personal",
    status: "needs_reauth",
    lastSyncAt: minsAgo(6 * 24 * 60 + 140),
    config: {
      syncEnabled: false,
      email: "maria.personal@gmail.com",
      lastVerifiedAt: minsAgo(6 * 24 * 60 + 138),
      lastVerificationOk: false,
      lastVerificationError: "Authorization expired. Reconnect to resume sync.",
    },
  },
];

export const providerCalendarsByConnection: Record<string, ProviderCalendar[]> = {
  conn_ms_1: [
    { id: "cal_ms_primary", name: "Calendar (Work)", primary: true },
    { id: "cal_ms_team", name: "Team Schedule" },
    { id: "cal_ms_ooo", name: "Out of Office" },
  ],
  conn_g_1: [
    { id: "cal_g_primary", name: "Front Desk", primary: true },
    { id: "cal_g_bookings", name: "Online Bookings" },
  ],
  conn_g_2: [{ id: "cal_g2_primary", name: "Personal", primary: true }],
};

export const integrationStatus = {
  googleCalendarConfigured: true,
  microsoftCalendarConfigured: true,
};
