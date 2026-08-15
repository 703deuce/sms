import type { FrontDeskUserData } from "./userdata";

/** Deterministic booking operation lifecycle — terminal states only when done. */
export type BookingOperationTerminalState = "confirmed" | "failed" | "cancelled";

export type BookingOperationActiveState = "collecting_email" | "writing_calendar";

export type BookingOperationState =
  | "idle"
  | BookingOperationActiveState
  | BookingOperationTerminalState;

export type BookingOperation = {
  state: BookingOperationState;
  slotId?: string;
  startedAtMs: number;
  updatedAtMs: number;
  errorReason?: string;
};

const ACTIVE_STATES: ReadonlySet<BookingOperationState> = new Set([
  "collecting_email",
  "writing_calendar",
]);

const TERMINAL_STATES: ReadonlySet<BookingOperationState> = new Set([
  "confirmed",
  "failed",
  "cancelled",
]);

export function getBookingOperation(ud: FrontDeskUserData): BookingOperation | undefined {
  return ud.bookingOperation;
}

export function isBookingOperationActive(ud: FrontDeskUserData): boolean {
  const state = ud.bookingOperation?.state;
  return Boolean(state && ACTIVE_STATES.has(state)) || Boolean(ud.bookingInProgress);
}

export function isBookingOperationTerminal(ud: FrontDeskUserData): boolean {
  const state = ud.bookingOperation?.state;
  return Boolean(state && TERMINAL_STATES.has(state));
}

export function beginBookingOperation(ud: FrontDeskUserData, slotId: string): void {
  const now = Date.now();
  ud.bookingOperation = {
    state: "collecting_email",
    slotId,
    startedAtMs: now,
    updatedAtMs: now,
  };
  ud.pendingSlotId = slotId;
}

export function markBookingOperationState(
  ud: FrontDeskUserData,
  state: BookingOperationState,
  errorReason?: string,
): void {
  const now = Date.now();
  const prev = ud.bookingOperation;
  ud.bookingOperation = {
    state,
    slotId: prev?.slotId ?? ud.pendingSlotId,
    startedAtMs: prev?.startedAtMs ?? now,
    updatedAtMs: now,
    errorReason: errorReason ?? prev?.errorReason,
  };
  if (TERMINAL_STATES.has(state)) {
    ud.bookingInProgress = false;
  }
}

export function markBookingOperationConfirmed(ud: FrontDeskUserData): void {
  markBookingOperationState(ud, "confirmed");
}

export function markBookingOperationFailed(ud: FrontDeskUserData, reason: string): void {
  markBookingOperationState(ud, "failed", reason);
  ud.bookingInProgress = false;
}

export function markBookingOperationCancelled(ud: FrontDeskUserData, reason?: string): void {
  markBookingOperationState(ud, "cancelled", reason);
  ud.bookingInProgress = false;
}

export function canStartScheduleAppointment(ud: FrontDeskUserData): boolean {
  if (isBookingOperationActive(ud)) return false;
  return true;
}

const LOCKED_CALENDAR_TOOLS = new Set([
  "list_available_slots",
  "schedule_appointment",
  "reschedule_appointment",
  "cancel_appointment",
]);

export function calendarToolBlockedReason(
  ud: FrontDeskUserData,
  toolName: string,
): string | null {
  if (!LOCKED_CALENDAR_TOOLS.has(toolName)) return null;
  if (!isBookingOperationActive(ud)) return null;

  const state = ud.bookingOperation?.state ?? (ud.bookingInProgress ? "writing_calendar" : "idle");
  return (
    `Cannot call ${toolName} while booking is in progress (${state}). ` +
    "Tell the caller you're finishing the booking step. " +
    "If they ask whether it worked, use check_booking_status."
  );
}

export function assertCalendarToolAllowed(ud: FrontDeskUserData, toolName: string): void {
  const reason = calendarToolBlockedReason(ud, toolName);
  if (reason) {
    throw new Error(reason);
  }
}
