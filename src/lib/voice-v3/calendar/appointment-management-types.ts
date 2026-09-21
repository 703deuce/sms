import type { NormalizedSchedulingPreference } from "../time/scheduling-types";
import type { AppointmentWhenConstraint } from "./appointment-lookup-when";
import type { ConfirmedBooking } from "./booking-types";

export type AppointmentManagementMode = "NONE" | "RESCHEDULE" | "CANCEL";

export type ReschedulePhase =
  | "NONE"
  | "RESCHEDULE_READY"
  | "RESCHEDULE_REVALIDATING"
  | "RESCHEDULE_COMMITTING"
  | "RESCHEDULE_CONFIRMED"
  | "RESCHEDULE_FAILED"
  | "RESCHEDULE_OUTCOME_UNKNOWN";

export type CancellationPhase =
  | "NONE"
  | "CANCELLATION_CONFIRMATION_REQUIRED"
  | "CANCELLATION_READY"
  | "CANCELLATION_COMMITTING"
  | "CANCELLATION_CONFIRMED"
  | "CANCELLATION_FAILED"
  | "CANCELLATION_OUTCOME_UNKNOWN";

export interface ExistingAppointmentCustomerIdentity {
  name?: string;
  phone?: string;
  email?: string;
}

export interface ExistingAppointment {
  internalBookingId: string;
  provider: "microsoft" | "google";
  providerEventId: string;
  providerCalendarId: string;
  /** Same Microsoft connection as certified FIND/BOOK. */
  providerConnectionId?: string;
  startUtc: string;
  endUtc: string;
  localStart: string;
  localEnd: string;
  timezone: string;
  customerIdentity: ExistingAppointmentCustomerIdentity;
  serviceId?: string;
  durationMinutes: number;
  status: "ACTIVE";
}

export interface ExistingAppointmentCandidate {
  candidateId: string;
  appointment: ExistingAppointment;
}

export interface ExistingAppointmentCandidateSet {
  candidateSetId: string;
  candidates: ExistingAppointmentCandidate[];
  createdAt: string;
}

export type AppointmentDiscriminator =
  | "name"
  | "phone"
  | "email"
  | "appointment_date"
  | "appointment_time"
  | "service"
  | "location"
  | "candidate_selection";

export interface AppointmentLookupState {
  generation: number;
  name?: string;
  phone?: string;
  email?: string;
  localDate?: string;
  service?: string;
  location?: string;
  ani?: string;
  lastUsefulDiscriminators: AppointmentDiscriminator[];
}

export interface FindExistingAppointmentRequest {
  callId: string;
  phone?: string;
  email?: string;
  customerName?: string;
  service?: string;
  location?: string;
  ani?: string;
  dateHint?: NormalizedSchedulingPreference | null;
  /** Raw YYYY-MM-DD from tool when provided. */
  dateExpression?: string | null;
  timezone?: string;
  /** When set, also searches configured Microsoft calendar (same connection as BOOK). */
  microsoftLookup?: boolean;
  /** Prior lookup constraints accumulated on this call. */
  lookupState?: AppointmentLookupState | null;
  /** Semantic when-clue for the existing appointment (normalized via scheduling normalizer). */
  appointmentWhen?: AppointmentWhenConstraint | null;
}

export type FindExistingAppointmentResult =
  | {
      status: "FOUND";
      appointment: ExistingAppointment;
      safeDisplay: string;
      /** True until caller confirms this is the appointment they mean. */
      needsConfirmation: boolean;
    }
  | {
      status: "MULTIPLE";
      candidateSet: ExistingAppointmentCandidateSet;
      usefulDiscriminators: AppointmentDiscriminator[];
    }
  | { status: "NEEDS_MORE_INFORMATION"; usefulDiscriminators: AppointmentDiscriminator[] }
  | { status: "NONE" }
  | { status: "VERIFICATION_FAILED"; reason: string };

export interface RescheduleAttemptSnapshot {
  attemptId: string;
  providerEventId: string;
  schedulingGeneration: number;
  offerSetId: string;
  slotId: string;
  commitPhase:
    | "PREPARING"
    | "REVALIDATING"
    | "READY_TO_COMMIT"
    | "COMMIT_SENT"
    | "CONFIRMED"
    | "FAILED"
    | "OUTCOME_UNKNOWN";
  createdAt: string;
}

export interface CancellationAttemptSnapshot {
  cancellationAttemptId: string;
  providerEventId: string;
  providerCalendarId: string;
  commitPhase:
    | "AWAITING_CONFIRMATION"
    | "READY"
    | "COMMIT_SENT"
    | "CONFIRMED"
    | "FAILED"
    | "OUTCOME_UNKNOWN";
  createdAt: string;
}

export function existingAppointmentFromConfirmed(booking: ConfirmedBooking, identity: ExistingAppointmentCustomerIdentity): ExistingAppointment {
  const start = new Date(booking.startUtc);
  const end = new Date(booking.endUtc);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  return {
    internalBookingId: booking.bookingAttemptId,
    provider: "microsoft",
    providerEventId: booking.providerEventId,
    providerCalendarId: booking.providerCalendarId,
    startUtc: booking.startUtc,
    endUtc: booking.endUtc,
    localStart: booking.localStart,
    localEnd: booking.localEnd,
    timezone: booking.timezone,
    customerIdentity: identity,
    serviceId: booking.serviceId,
    durationMinutes,
    status: "ACTIVE",
  };
}
