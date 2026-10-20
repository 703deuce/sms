export interface CancelBookingRequest {
  callId: string;
  cancellationAttemptId: string;
  providerCalendarId: string;
  providerEventId: string;
}
