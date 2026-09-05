/** Transovo Video domain types — provider-agnostic. */

export const TELNYX_VIDEO_MAX_PARTICIPANTS = 50;
export const TELNYX_VIDEO_MIN_PARTICIPANTS = 2;

export type VideoMeetingStatus =
  | "scheduled"
  | "waiting"
  | "active"
  | "ended"
  | "canceled"
  | "failed";

export type VideoProvisioningStatus =
  | "pending"
  | "provisioning"
  | "ready"
  | "failed"
  | "deleting"
  | "deleted";

export type VideoRecordingMode = "off" | "manual" | "automatic";

export type VideoScreenSharePolicy = "all" | "host_only" | "none";

export type VideoParticipantRole = "host" | "co_host" | "guest";

export type VideoParticipantState =
  | "invited"
  | "waiting"
  | "admitted"
  | "joining"
  | "connected"
  | "left"
  | "removed"
  | "declined";

export type ArtifactPipelineStatus =
  | "disabled"
  | "pending"
  | "recording"
  | "processing"
  | "ready"
  | "failed";

export type EventTypeVideoConfig = {
  enabled?: boolean;
  maxParticipants?: number;
  requireHost?: boolean;
  requireGuestName?: boolean;
  requireGuestEmail?: boolean;
  requirePasscode?: boolean;
  passcode?: string;
  waitingRoom?: boolean;
  guestCamera?: boolean;
  guestMicrophone?: boolean;
  guestScreenShare?: boolean;
  guestChat?: boolean;
  recordingMode?: VideoRecordingMode;
  transcription?: boolean;
  aiRecap?: boolean;
  actionItems?: boolean;
  followUp?: boolean;
  postMeetingRedirect?: string | null;
};

export type TransovoVideoPlatformConfig = {
  enabled?: boolean;
  defaultMaxParticipants?: number;
  requireGuestEmail?: boolean;
  requireHost?: boolean;
  waitingRoom?: boolean;
  guestScreenShare?: boolean;
  guestChat?: boolean;
  defaultRecordingMode?: VideoRecordingMode;
  defaultTranscription?: boolean;
  defaultAiRecap?: boolean;
  defaultActionItems?: boolean;
  defaultFollowUp?: boolean;
  defaultJoinWindowMinutesBefore?: number;
  defaultJoinWindowMinutesAfter?: number;
  defaultPostMeetingRedirect?: string | null;
};

export const DEFAULT_TRANSOVO_VIDEO_CONFIG: TransovoVideoPlatformConfig = {
  enabled: true,
  defaultMaxParticipants: 10,
  requireGuestEmail: true,
  requireHost: false,
  waitingRoom: false,
  guestScreenShare: true,
  guestChat: true,
  defaultRecordingMode: "off",
  defaultTranscription: false,
  defaultAiRecap: false,
  defaultActionItems: false,
  defaultFollowUp: false,
  defaultJoinWindowMinutesBefore: 15,
  defaultJoinWindowMinutesAfter: 30,
  defaultPostMeetingRedirect: null,
};

export const VIDEO_STATUS_LABELS: Record<VideoMeetingStatus, string> = {
  scheduled: "Scheduled",
  waiting: "Waiting",
  active: "In progress",
  ended: "Ended",
  canceled: "Canceled",
  failed: "Failed",
};

export const TRANSOVO_VIDEO_LOCATION_LABEL = "Transovo Video";

export function isTransovoVideoLocation(input?: {
  kind?: string;
  name?: string;
  location?: string;
}): boolean {
  const kind = input?.kind?.toLowerCase();
  const name = (input?.name || input?.location || "").toLowerCase();
  return kind === "transovo_video" || name === "transovo video";
}
