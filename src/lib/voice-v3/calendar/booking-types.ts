export type BookingPhase =
  | "NONE"
  | "SLOT_SELECTED"
  | "BOOKING_REVALIDATING"
  | "BOOKING_CREATING"
  | "BOOKING_CONFIRMED"
  | "BOOKING_FAILED"
  | "BOOKING_OUTCOME_UNKNOWN";

export type BookingCommitPhase =
  | "PREPARING"
  | "REVALIDATING"
  | "READY_TO_COMMIT"
  | "COMMIT_SENT"
  | "CONFIRMED"
  | "FAILED"
  | "OUTCOME_UNKNOWN";

export type BookingFailureReason =
  | "SLOT_NO_LONGER_AVAILABLE"
  | "MICROSOFT_AUTH_FAILED"
  | "MICROSOFT_THROTTLED"
  | "MICROSOFT_TEMPORARY_FAILURE"
  | "BOOKING_VALIDATION_FAILED"
  | "BOOKING_OUTCOME_UNKNOWN"
  | "BOOKING_ATTEMPT_STALE"
  | "configuration_missing";

export interface CreateBookingRequest {
  callId: string;
  bookingAttemptId: string;
  schedulingGeneration: number;
  offerSetId: string;
  slotId: string;
  calendarId: string;
  startUtc: string;
  endUtc: string;
  timezone: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
  };
}

export type VoiceV3CalendarBookingProvider = "microsoft" | "google";

export interface ConfirmedBooking {
  bookingAttemptId: string;
  provider: VoiceV3CalendarBookingProvider;
  providerEventId: string;
  providerCalendarId: string;
  startUtc: string;
  endUtc: string;
  localStart: string;
  localEnd: string;
  timezone: string;
  customerName: string;
  serviceId: string;
  confirmedAt: string;
  offerSetId: string;
  slotId: string;
  schedulingGeneration: number;
}

export interface BookingFailure {
  reason: BookingFailureReason;
  message: string;
  at: string;
  bookingAttemptId: string | null;
  schedulingGeneration: number;
}

export interface BookingAttemptSnapshot {
  bookingAttemptId: string;
  schedulingGeneration: number;
  offerSetId: string;
  slotId: string;
  commitPhase: BookingCommitPhase;
  createdAt: string;
  updatedAt: string;
}
