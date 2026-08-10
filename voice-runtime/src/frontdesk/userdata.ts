import type { CalendlyCalendar } from "./calendly-calendar";

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
  /** Set after a successful schedule_appointment. */
  bookingComplete?: boolean;
  bookedTimeLabel?: string;
  pendingSlotId?: string;
};

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
