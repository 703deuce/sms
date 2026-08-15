import { findBookingPrerequisiteGaps, type BookingPrerequisiteGap } from "./booking-prerequisites";
import { getBookingOperation, isBookingOperationActive } from "./booking-operation";
import { isBookingConfirmed, type FrontDeskUserData } from "./userdata";

export type BookingWorkflowPhase = "idle" | "intake" | "availability" | "confirmation" | "commit";

export type AuthoritativeBookingState = {
  phase: BookingWorkflowPhase;
  status: "idle" | "collecting" | "writing" | "confirmed" | "failed" | "cancelled";
  selectedSlotId?: string;
  confirmedEmail?: string;
  fields: Record<string, string>;
  missingFields: BookingPrerequisiteGap[];
  preferredTime?: string;
  operationState?: string;
  operationStartedAtMs?: number;
  receipt?: {
    slotId?: string;
    providerEventId?: string;
    appointmentId?: string;
    bookedTimeLabel?: string;
  };
  intakeActive: boolean;
};

function derivePhase(ud: FrontDeskUserData, missing: BookingPrerequisiteGap[]): BookingWorkflowPhase {
  if (isBookingConfirmed(ud)) return "commit";
  const op = getBookingOperation(ud);
  if (op?.state === "writing_calendar" || ud.bookingInProgress) return "commit";
  if (ud.bookingIntakeActive || missing.length > 0) return "intake";
  if (ud.pendingSlotId || op?.slotId) return "confirmation";
  return "idle";
}

function deriveStatus(ud: FrontDeskUserData): AuthoritativeBookingState["status"] {
  if (isBookingConfirmed(ud)) return "confirmed";
  const op = getBookingOperation(ud);
  if (op?.state === "failed") return "failed";
  if (op?.state === "cancelled") return "cancelled";
  if (op?.state === "writing_calendar" || ud.bookingInProgress) return "writing";
  if (ud.bookingIntakeActive || isBookingOperationActive(ud)) return "collecting";
  return "idle";
}

/** Single authoritative view of booking progress — derived, not transcript-based. */
export function deriveAuthoritativeBookingState(
  ud: FrontDeskUserData,
  inlineEmail?: string,
): AuthoritativeBookingState {
  const missingFields = findBookingPrerequisiteGaps(ud, inlineEmail);
  const fields = { ...(ud.receptionistFields || {}) };
  const preferredTime =
    fields.preferred_time?.trim() ||
    fields.preferredTime?.trim() ||
    fields.appointment_time?.trim() ||
    undefined;

  const op = getBookingOperation(ud);
  const receipt = ud.booking?.status === "confirmed" ? ud.booking : undefined;

  return {
    phase: derivePhase(ud, missingFields),
    status: deriveStatus(ud),
    selectedSlotId: ud.pendingSlotId || op?.slotId || ud.booking?.slotId,
    confirmedEmail: ud.confirmedEmail,
    fields,
    missingFields,
    preferredTime,
    operationState: op?.state,
    operationStartedAtMs: op?.startedAtMs,
    receipt: receipt
      ? {
          slotId: receipt.slotId,
          providerEventId: receipt.providerEventId,
          appointmentId: receipt.appointmentId,
          bookedTimeLabel: receipt.bookedTimeLabel,
        }
      : undefined,
    intakeActive: Boolean(ud.bookingIntakeActive),
  };
}
