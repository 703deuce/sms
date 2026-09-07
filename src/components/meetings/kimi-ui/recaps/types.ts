export type MeetingRow = {
  id: string;
  title: string | null;
  status: string;
  meetingPlatform: "zoom" | "google_meet" | "microsoft_teams" | "webex" | "unknown_supported";
  scheduledStartAt: string | null;
  appointmentId?: string | null;
  appointmentLabel?: string | null;
  meetingUrl?: string;
  recordingStatus?: string;
  summaryStatus?: string;
  durationMinutes?: number | null;
  attendeeCount?: number | null;
  /** Public share token for the recap — present when a shared recap link is active. */
  shareToken?: string | null;
};

export const MEETING_STATUS_LABELS: Record<string, string> = {
  disabled: "Off",
  pending: "Pending",
  scheduled: "Scheduled",
  joining: "Joining",
  awaiting_admission: "Awaiting admission",
  active: "In meeting",
  recording: "Recording",
  ended: "Ended",
  processing: "Processing recap",
  completed: "Recap ready",
  canceled: "Canceled",
  failed: "Failed",
  no_recap: "No recap available",
};

export function meetingPlatformLabel(platform: MeetingRow["meetingPlatform"]): string {
  switch (platform) {
    case "zoom": return "Zoom";
    case "google_meet": return "Google Meet";
    case "microsoft_teams": return "Microsoft Teams";
    case "webex": return "Webex";
    default: return "Online meeting";
  }
}

const now = Date.now();
const H = 3600_000;
const D = 24 * H;

export const MOCK_MEETINGS: MeetingRow[] = [
  {
    id: "mtg-01",
    title: "Initial consultation — Sarah Johnson",
    status: "scheduled",
    meetingPlatform: "zoom",
    scheduledStartAt: new Date(now + 3 * H).toISOString(),
    appointmentId: "appt-104",
    appointmentLabel: "Initial consultation",
    meetingUrl: "https://zoom.us/j/84219023741",
  },
  {
    id: "mtg-02",
    title: "Follow-up — Mike Torres",
    status: "recording",
    meetingPlatform: "google_meet",
    scheduledStartAt: new Date(now - 0.4 * H).toISOString(),
    meetingUrl: "https://meet.google.com/abc-defg-hij",
    recordingStatus: "recording",
  },
  {
    id: "mtg-03",
    title: "Water heater estimate review",
    status: "processing",
    meetingPlatform: "zoom",
    scheduledStartAt: new Date(now - 1.2 * H).toISOString(),
    recordingStatus: "ready",
    summaryStatus: "processing",
    durationMinutes: 38,
  },
  {
    id: "mtg-04",
    title: "Weekly ops sync",
    status: "completed",
    meetingPlatform: "microsoft_teams",
    scheduledStartAt: new Date(now - 1 * D).toISOString(),
    recordingStatus: "ready",
    summaryStatus: "ready",
    durationMinutes: 31,
    attendeeCount: 6,
    shareToken: "shr_ops7k2m9",
  },
  {
    id: "mtg-05",
    title: "Consultation — Emily Chen",
    status: "completed",
    meetingPlatform: "google_meet",
    scheduledStartAt: new Date(now - 2 * D).toISOString(),
    appointmentId: "appt-98",
    appointmentLabel: "Consultation",
    recordingStatus: "ready",
    summaryStatus: "ready",
    durationMinutes: 45,
    attendeeCount: 3,
  },
  {
    id: "mtg-06",
    title: "Vendor onboarding call",
    status: "failed",
    meetingPlatform: "webex",
    scheduledStartAt: new Date(now - 3 * D).toISOString(),
    recordingStatus: "failed",
    summaryStatus: "failed",
    durationMinutes: 22,
  },
  {
    id: "mtg-07",
    title: "Quarterly planning",
    status: "no_recap",
    meetingPlatform: "zoom",
    scheduledStartAt: new Date(now - 4 * D).toISOString(),
    durationMinutes: 60,
    attendeeCount: 9,
  },
  {
    id: "mtg-08",
    title: "Customer success check-in — Apex Dental",
    status: "canceled",
    meetingPlatform: "microsoft_teams",
    scheduledStartAt: new Date(now - 5 * D).toISOString(),
    appointmentId: "appt-77",
    appointmentLabel: "Check-in",
  },
  {
    id: "mtg-09",
    title: "Discovery call — Northwind Traders",
    status: "completed",
    meetingPlatform: "zoom",
    scheduledStartAt: new Date(now - 6 * D).toISOString(),
    recordingStatus: "ready",
    summaryStatus: "ready",
    durationMinutes: 52,
    attendeeCount: 4,
  },
  {
    id: "mtg-10",
    title: "Reschedule discussion — Dana White",
    status: "awaiting_admission",
    meetingPlatform: "google_meet",
    scheduledStartAt: new Date(now + 26 * H).toISOString(),
    meetingUrl: "https://meet.google.com/xyz-abcd-qrs",
  },
];
