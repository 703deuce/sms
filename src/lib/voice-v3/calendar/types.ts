export type FindAvailabilityStatus =
  | "idle"
  | "pending"
  | "ready"
  | "empty"
  | "failed";

export type RequiredRuntimeAction = "FIND_AVAILABILITY" | null;

export interface FindAvailabilityRequest {
  callId: string;
  schedulingGeneration: number;
  timezone: string;
  rangeStartUtc: string;
  rangeEndUtc: string;
  durationMinutes: number;
  calendarIds: string[];
  /** Deterministic dedupe identity */
  requestKey: string;
}

export interface CalendarBusyInterval {
  calendarId: string;
  startUtc: string;
  endUtc: string;
}

export type FindAvailabilityFailureReason =
  | "microsoft_token"
  | "microsoft_timeout"
  | "microsoft_throttled"
  | "microsoft_malformed"
  | "microsoft_error"
  | "configuration_missing";

export interface FindAvailabilityFailure {
  reason: FindAvailabilityFailureReason;
  message: string;
  at: string;
  schedulingGeneration: number;
}

export interface BusinessHoursWindow {
  /** 0 = Sunday … 6 = Saturday */
  weekdays: number[];
  startLocal: string; // HH:mm
  endLocal: string; // HH:mm
}

export interface VoiceV3CalendarConfig {
  provider: "microsoft";
  connectionId: string;
  calendarIds: string[];
  smtp?: string | null;
}
