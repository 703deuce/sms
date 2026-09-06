export type ProviderCalendar = { id: string; name: string; primary?: boolean };

export type ImportRules = {
  requireExternalAttendees?: boolean;
  requireAttendeeEmail?: boolean;
  skipAllDay?: boolean;
  titleIncludePatterns?: string[];
  titleExcludePatterns?: string[];
};

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
    importRules?: ImportRules;
    lastVerifiedAt?: string;
    lastVerificationOk?: boolean;
    lastVerificationError?: string | null;
    microsoftSubscription?: { expiresAt?: string };
  } | null;
};

export type InboundChannel = {
  id: "calendly" | "email";
  label: string;
  description: string;
  status: "active" | "inactive" | "degraded";
  endpointLabel: string;
  lastEventAt?: string | null;
  lastEventSummary?: string;
  eventsLast7d: number;
};

export const providerCalendarsByConnection: Record<string, ProviderCalendar[]> = {
  conn_google_1: [
    { id: "primary", name: "Anthony Rivera (primary)", primary: true },
    { id: "work", name: "Work — Bright Dental" },
    { id: "personal", name: "Personal" },
    { id: "holidays", name: "Holidays in United States" },
  ],
  conn_ms_1: [
    { id: "calendar", name: "Calendar (primary)", primary: true },
    { id: "team", name: "Team Schedule" },
    { id: "us-holidays", name: "United States holidays" },
  ],
};

export const initialConnections: CalendarConnection[] = [
  {
    id: "conn_google_1",
    provider: "google",
    name: "Google Calendar",
    status: "connected",
    lastSyncAt: "2026-09-08T14:03:00Z",
    config: {
      email: "anthony@brightdental.com",
      writeCalendarId: "primary",
      blockingCalendarIds: ["work", "personal"],
      importCalendarIds: [],
      syncEnabled: true,
      importRules: {
        requireExternalAttendees: true,
        requireAttendeeEmail: true,
        skipAllDay: true,
        titleIncludePatterns: [],
        titleExcludePatterns: ["lunch", "personal"],
      },
      lastVerifiedAt: "2026-09-08T13:40:00Z",
      lastVerificationOk: true,
      lastVerificationError: null,
    },
  },
  {
    id: "conn_ms_1",
    provider: "microsoft",
    name: "Microsoft Outlook",
    status: "needs_reauth",
    lastSyncAt: "2026-09-04T09:12:00Z",
    config: {
      email: "office@brightdental.com",
      writeCalendarId: "calendar",
      blockingCalendarIds: ["calendar"],
      importCalendarIds: ["calendar"],
      syncEnabled: true,
      importRules: {
        requireExternalAttendees: true,
        requireAttendeeEmail: false,
        skipAllDay: true,
        titleIncludePatterns: [],
        titleExcludePatterns: [],
      },
      lastVerifiedAt: "2026-09-04T09:12:00Z",
      lastVerificationOk: false,
      lastVerificationError: "Authorization expired. Reconnect to resume sync.",
      microsoftSubscription: { expiresAt: "2026-09-06T00:00:00Z" },
    },
  },
];

export const inboundChannels: InboundChannel[] = [
  {
    id: "calendly",
    label: "Calendly webhook",
    description:
      "Events scheduled in Calendly are ingested as Transovo appointments and can receive reminders.",
    status: "active",
    endpointLabel: "/api/integrations/calendly/webhook",
    lastEventAt: "2026-09-08T11:26:00Z",
    lastEventSummary: "invite.created — Initial Consultation, Sep 12 at 10:00 AM",
    eventsLast7d: 14,
  },
  {
    id: "email",
    label: "Inbound email booking",
    description:
      "Booking requests emailed to your workspace address are read by AI and turned into appointments.",
    status: "degraded",
    endpointLabel: "bookings@mail.transovo.app",
    lastEventAt: "2026-09-07T16:41:00Z",
    lastEventSummary: "Last message couldn't be parsed — no date found. Moved to review.",
    eventsLast7d: 3,
  },
];

export const integrationStatus = {
  googleCalendarConfigured: true,
  microsoftCalendarConfigured: true,
};

export const emptyConnections: CalendarConnection[] = [];
