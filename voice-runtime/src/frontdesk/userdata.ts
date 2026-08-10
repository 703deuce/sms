import type { CalendlyCalendar } from "./calendly-calendar";

export type BookingStatus = "pending" | "confirmed";

export type FrontDeskBookingState = {
  status: BookingStatus;
  slotId?: string;
  providerEventId?: string;
  appointmentId?: string;
  bookedTimeLabel?: string;
};

export type FrontDeskUserData = {
  workspaceId: string;
  agentId: string;
  callId: string;
  businessName: string;
  timezone: string;
  cal: CalendlyCalendar;
  slotUnavailableCount: number;
  /** Email captured but not yet confirmed by caller. */
  draftEmail?: string;
  /** Confirmed email for Calendly — persists for the whole call. */
  confirmedEmail?: string;
  /** Caller ANI for appointment lookup (cancel/reschedule). */
  callerE164?: string;
  /** Canonical booking state for server-side duplicate guards. */
  booking?: FrontDeskBookingState;
  /** @deprecated Prefer booking.status === "confirmed". */
  bookingComplete?: boolean;
  bookedTimeLabel?: string;
  pendingSlotId?: string;
};

export function isBookingConfirmed(userData: FrontDeskUserData): boolean {
  return userData.booking?.status === "confirmed" || Boolean(userData.bookingComplete);
}

export function markBookingConfirmed(
  userData: FrontDeskUserData,
  input: {
    slotId?: string;
    providerEventId?: string;
    appointmentId?: string;
    bookedTimeLabel: string;
  },
): void {
  userData.booking = {
    status: "confirmed",
    slotId: input.slotId,
    providerEventId: input.providerEventId,
    appointmentId: input.appointmentId,
    bookedTimeLabel: input.bookedTimeLabel,
  };
  userData.bookingComplete = true;
  userData.bookedTimeLabel = input.bookedTimeLabel;
}

export function isFrontDeskUserData(
  value: unknown,
): value is FrontDeskUserData {
  return Boolean(
    value &&
      typeof value === "object" &&
      "cal" in value &&
      (value as FrontDeskUserData).cal,
  );
}

export function livekitProfileFromConfig(
  advanced: Record<string, unknown> | undefined,
): string {
  return String(advanced?.livekitProfile || "").trim().toLowerCase();
}

export function isFrontDeskProfile(advanced: Record<string, unknown> | undefined): boolean {
  return livekitProfileFromConfig(advanced) === "frontdesk";
}
