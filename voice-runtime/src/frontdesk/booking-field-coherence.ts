import {
  markBookingOperationCancelled,
} from "./booking-operation";
import { isBookingConfirmed, type FrontDeskUserData } from "./userdata";

const TIME_PREFERENCE_FIELD_IDS = new Set([
  "preferred_time",
  "preferredTime",
  "appointment_time",
  "preferred_day",
  "preferred_day_time",
]);

export function isTimePreferenceField(fieldId: string): boolean {
  if (TIME_PREFERENCE_FIELD_IDS.has(fieldId)) return true;
  const lower = fieldId.toLowerCase();
  return lower.includes("preferred") || lower.includes("appointment_time");
}

/** Tool-persisted fields must not be overwritten by chat backfill heuristics. */
export function markFieldAuthoritative(ud: FrontDeskUserData, fieldId: string): void {
  if (!ud.authoritativeFieldIds) ud.authoritativeFieldIds = [];
  if (!ud.authoritativeFieldIds.includes(fieldId)) {
    ud.authoritativeFieldIds.push(fieldId);
  }
}

export type FieldPersistCoherence = {
  corrected: boolean;
  slotInvalidated: boolean;
};

/**
 * After a receptionist field is persisted, reconcile slot selection and authoritative locks.
 * Time-preference changes invalidate a stale pending slot (not an in-flight write).
 */
export function afterReceptionistFieldPersisted(
  ud: FrontDeskUserData,
  fieldId: string,
  normalized: string,
  previousValue?: string,
): FieldPersistCoherence {
  markFieldAuthoritative(ud, fieldId);

  const previous = previousValue?.trim() || "";
  const corrected = Boolean(previous && previous !== normalized);
  let slotInvalidated = false;

  if (isTimePreferenceField(fieldId)) {
    slotInvalidated = invalidateStaleSlotSelection(ud, "time_preference_changed");
  }

  return { corrected, slotInvalidated };
}

/** Clear pending slot when caller changes time preference — never during confirmed or active write. */
export function invalidateStaleSlotSelection(
  ud: FrontDeskUserData,
  reason: string,
): boolean {
  if (isBookingConfirmed(ud) || ud.bookingInProgress) return false;

  const hadSlot = ud.pendingSlotId || ud.bookingOperation?.slotId;
  if (!hadSlot) return false;

  ud.pendingSlotId = undefined;

  const opState = ud.bookingOperation?.state;
  if (!ud.bookingOperation) return true;

  if (opState === "failed" || opState === "collecting_email") {
    ud.bookingOperation = undefined;
    ud.bookingInProgress = false;
    return true;
  }

  if (opState !== "confirmed" && opState !== "writing_calendar") {
    markBookingOperationCancelled(ud, reason);
  }

  return true;
}
