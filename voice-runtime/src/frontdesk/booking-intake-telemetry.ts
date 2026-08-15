type BookingIntakeTelemetryEvent =
  | "field_detected"
  | "field_persisted"
  | "field_corrected"
  | "field_validation_failed"
  | "requirements_recomputed"
  | "intake_complete"
  | "booking_attempt"
  | "booking_result"
  | "idempotent_replay"
  | "slot_invalidated";

export function logBookingIntake(
  callId: string,
  event: BookingIntakeTelemetryEvent,
  detail: Record<string, unknown> = {},
): void {
  console.log(
    JSON.stringify({
      source: "booking-intake",
      event,
      callId,
      ts: Date.now(),
      ...detail,
    }),
  );
}
