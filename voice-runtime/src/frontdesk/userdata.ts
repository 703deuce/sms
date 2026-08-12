import type { CalendlyCalendar } from "./calendly-calendar";
import {
  isFrontDeskProfile as isFrontDeskProfileFromConfig,
  usesFrontDeskRealtimeVoicePipeline,
} from "@/lib/voice/frontdesk/agent-config";
import type { RealEstateCallState } from "@/lib/voice/real-estate/types";
import type { CompiledRealEstateFrontDesk } from "@/lib/voice/real-estate/compile/types";

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
  /** LiveKit room/participant for SIP transfer (set at session start). */
  livekitRoomName?: string;
  livekitParticipantId?: string;
  /** Canonical booking state for server-side duplicate guards. */
  booking?: FrontDeskBookingState;
  /** Real estate front desk runtime state (intent, fields, lead status). */
  callState?: RealEstateCallState;
  /** Compiled template configuration for this session — authoritative field/intent rules. */
  realEstateCompiled?: CompiledRealEstateFrontDesk;
  agentConfigVersion?: number;
  agentVersionId?: string;
  /** @deprecated Prefer booking.status === "confirmed". */
  bookingComplete?: boolean;
  bookedTimeLabel?: string;
  pendingSlotId?: string;
  /** Prevents duplicate booking confirmation SMS on retry or reschedule. */
  bookingConfirmationSmsSent?: boolean;
  /** True while schedule_appointment is writing to Calendly. */
  bookingInProgress?: boolean;
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

export function markBookingCancelled(userData: FrontDeskUserData): void {
  userData.booking = undefined;
  userData.bookingComplete = false;
  userData.bookedTimeLabel = undefined;
  userData.pendingSlotId = undefined;
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
  return isFrontDeskProfileFromConfig({ advanced });
}

export { usesFrontDeskRealtimeVoicePipeline };
