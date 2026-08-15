import type { FrontDeskUserData } from "./userdata";
import type { BookingIntakeResult } from "./booking-intake-task";
import { deriveAuthoritativeBookingState } from "./booking-state";

export const TOOL_RESULT_BOOKING_INTAKE_SILENT =
  "BOOKING_INTAKE_ACTIVE_SILENT: Booking intake owns speech. Do not speak — questions are handled by the intake task.";

export function buildBookingIntakeToolResult(
  ud: FrontDeskUserData,
  result: BookingIntakeResult,
): string {
  const state = deriveAuthoritativeBookingState(ud);
  const summary = Object.entries(state.fields)
    .filter(([, value]) => value?.trim())
    .map(([id, value]) => `${id}=${value.trim()}`)
    .join(", ");

  if (!result.complete) {
    const missing = state.missingFields.map((f) => f.fieldId).join(", ");
    return summary
      ? `BOOKING_INTAKE_PARTIAL: ${summary}. Still missing: ${missing || "unknown"}. Intake task owns speech — do not speak.`
      : TOOL_RESULT_BOOKING_INTAKE_SILENT;
  }

  ud.receptionistFieldCollectionComplete = true;
  ud.receptionistFieldsAcknowledged = true;

  const slotId = state.selectedSlotId;
  const bookingTail = slotId
    ? ` Call schedule_appointment immediately with slot_id ${slotId} to complete booking.`
    : "";

  return (
    `BOOKING_INTAKE_COMPLETE: ${summary || "no fields"}. ` +
    "All booking requirements are satisfied in authoritative state. " +
    "Do not reconfirm captured fields." +
    bookingTail
  );
}
