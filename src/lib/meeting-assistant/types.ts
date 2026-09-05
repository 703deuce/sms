/** AI Notetaker domain types — provider-agnostic. */

export type MeetingPlatform =
  | "zoom"
  | "google_meet"
  | "microsoft_teams"
  | "webex"
  | "transovo_video"
  | "unknown_supported"
  | "unsupported";

export type MeetingSessionStatus =
  | "disabled"
  | "pending"
  | "scheduled"
  | "joining"
  | "awaiting_admission"
  | "active"
  | "recording"
  | "ended"
  | "processing"
  | "completed"
  | "canceled"
  | "failed"
  | "no_recap";

export type ArtifactStatus = "pending" | "processing" | "ready" | "failed";

export type NotetakerJoinRule =
  | "all_supported"
  | "transovo_only"
  | "connected_calendar"
  | "external_participants"
  | "selected_types"
  | "manual_only";

export type SummaryTemplateId =
  | "general"
  | "sales"
  | "consultation"
  | "customer_success"
  | "interview"
  | "project_status"
  | "one_on_one"
  | "custom";

export type NotetakerPlatformConfig = {
  enabled?: boolean;
  joinRule?: NotetakerJoinRule;
  selectedEventTypeIds?: string[];
  externalParticipantsOnly?: boolean;
  recordingEnabled?: boolean;
  transcriptEnabled?: boolean;
  summaryEnabled?: boolean;
  actionItemsEnabled?: boolean;
  followUpEnabled?: boolean;
  botName?: string;
  summaryTemplate?: SummaryTemplateId;
  notifyAttendeesAdvance?: boolean;
  advanceNoticeText?: string;
  emailOnRecapReady?: boolean;
  autoShareWith?: "nobody" | "organizer" | "internal" | "all_attendees";
  recordingRetentionDays?: number | null;
  transcriptRetentionDays?: number | null;
};

export type EventTypeNotetakerConfig = {
  enabled?: boolean;
  autoJoin?: boolean;
  recordingEnabled?: boolean;
  transcriptEnabled?: boolean;
  summaryEnabled?: boolean;
  actionItemsEnabled?: boolean;
  followUpEnabled?: boolean;
  summaryTemplate?: SummaryTemplateId;
};

export const DEFAULT_NOTETAKER_CONFIG: NotetakerPlatformConfig = {
  enabled: true,
  joinRule: "transovo_only",
  recordingEnabled: true,
  transcriptEnabled: true,
  summaryEnabled: true,
  actionItemsEnabled: true,
  followUpEnabled: true,
  botName: "Transovo Notetaker",
  summaryTemplate: "general",
  notifyAttendeesAdvance: true,
  advanceNoticeText:
    "An AI Notetaker may join this meeting to record, transcribe, and prepare meeting notes.",
  emailOnRecapReady: true,
  autoShareWith: "nobody",
  recordingRetentionDays: 90,
  transcriptRetentionDays: 365,
};

export const MEETING_STATUS_LABELS: Record<MeetingSessionStatus, string> = {
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
