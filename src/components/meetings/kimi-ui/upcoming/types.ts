export type MeetingPlatform =
  | "zoom"
  | "google_meet"
  | "microsoft_teams"
  | "webex"
  | "transovo_video"
  | "unknown_supported";

export type UpcomingSession = {
  id: string;
  title: string | null;
  status: string;
  meetingPlatform: MeetingPlatform;
  meetingUrl: string;
  scheduledStartAt: string | null;
  /** Present when Transovo hosts the video room (host join available) */
  appointmentTitle?: string | null;
  participants?: string[];
  hostJoinUrl?: string;
  appointmentId?: string | null;
  videoMeetingId?: string | null;
};

export type RecentRecap = {
  id: string;
  title: string | null;
  scheduledStartAt: string | null;
  meetingPlatform: MeetingPlatform;
};

export type VideoMeetingRow = {
  id: string;
  title: string | null;
  status: string;
  scheduledStartAt: string | null;
  meetingUrl: string;
  hostJoinUrl: string;
  appointmentId: string | null;
};

export type OverviewData = {
  entitlements: { aiNotetaker: boolean; transovoVideo?: boolean };
  upcomingSessions: UpcomingSession[];
  upcomingVideoMeetings?: VideoMeetingRow[];
  recentRecaps: RecentRecap[];
  /** Set when part of the overview (recaps) failed to load — degraded state */
  recapsDegraded?: boolean;
};

export const mockOverview: OverviewData = {
  entitlements: { aiNotetaker: true },
  upcomingSessions: [
    {
      id: "ms_01",
      title: "Discovery call — Anthony Johnson",
      status: "scheduled",
      meetingPlatform: "zoom",
      meetingUrl: "https://zoom.us/j/8841209331",
      scheduledStartAt: "2026-04-18T14:00:00-04:00",
    },
    {
      id: "ms_tv1",
      title: "Water heater estimate — Sarah Johnson",
      status: "scheduled",
      meetingPlatform: "transovo_video",
      meetingUrl: "/video/room/ms_tv1",
      scheduledStartAt: "2026-04-18T15:30:00-04:00",
      appointmentTitle: "Water Heater Estimate",
      participants: ["Sarah Johnson (customer)", "You (host)"],
    },
    {
      id: "ms_02",
      title: "Weekly project status",
      status: "scheduled",
      meetingPlatform: "google_meet",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      scheduledStartAt: "2026-04-18T16:30:00-04:00",
    },
    {
      id: "ms_03",
      title: "Consultation — Sarah Miller",
      status: "pending",
      meetingPlatform: "microsoft_teams",
      meetingUrl: "https://teams.microsoft.com/l/meetup-join/19%3ameeting",
      scheduledStartAt: "2026-04-21T10:00:00-04:00",
    },
    {
      id: "ms_04",
      title: "Customer success check-in",
      status: "scheduled",
      meetingPlatform: "webex",
      meetingUrl: "https://company.webex.com/meet/jdoe",
      scheduledStartAt: "2026-04-22T13:00:00-04:00",
    },
  ],
  recentRecaps: [
    {
      id: "rc_01",
      title: "Onboarding review — Bright Dental",
      scheduledStartAt: "2026-04-16T11:00:00-04:00",
      meetingPlatform: "zoom",
    },
    {
      id: "rc_02",
      title: "Sales follow-up — Marcus Lee",
      scheduledStartAt: "2026-04-15T15:30:00-04:00",
      meetingPlatform: "google_meet",
    },
    {
      id: "rc_03",
      title: "Team standup",
      scheduledStartAt: "2026-04-15T09:00:00-04:00",
      meetingPlatform: "microsoft_teams",
    },
    {
      id: "rc_04",
      title: null,
      scheduledStartAt: "2026-04-14T13:00:00-04:00",
      meetingPlatform: "unknown_supported",
    },
  ],
};

/** First-use empty overview (no meetings yet, notetaker never used) */
export const mockOverviewEmpty: OverviewData = {
  entitlements: { aiNotetaker: true },
  upcomingSessions: [],
  recentRecaps: [],
};

/** Not-entitled overview (plan without AI Notetaker) */
export const mockOverviewUnentitled: OverviewData = {
  entitlements: { aiNotetaker: false },
  upcomingSessions: [],
  recentRecaps: [],
};

export function meetingPlatformLabel(platform: MeetingPlatform): string {
  switch (platform) {
    case "zoom":
      return "Zoom";
    case "google_meet":
      return "Google Meet";
    case "microsoft_teams":
      return "Microsoft Teams";
    case "webex":
      return "Webex";
    case "transovo_video":
      return "Transovo Video";
    default:
      return "Online meeting";
  }
}

export function detectMeetingPlatform(url: string): MeetingPlatform | "unsupported" {
  const u = url.trim().toLowerCase();
  if (!u) return "unsupported";
  if (u.includes("/video/")) return "transovo_video";
  if (u.includes("zoom.us") || u.includes("zoom.com")) return "zoom";
  if (u.includes("meet.google.com") || u.includes("google.com/meet"))
    return "google_meet";
  if (u.includes("teams.microsoft.com") || u.includes("teams.live.com"))
    return "microsoft_teams";
  if (u.includes("webex.com")) return "webex";
  if (u.startsWith("http://") || u.startsWith("https://"))
    return "unknown_supported";
  return "unsupported";
}

export function formatMeetingDate(iso: string | null): string {
  if (!iso) return "Time not set";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatRecapDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
