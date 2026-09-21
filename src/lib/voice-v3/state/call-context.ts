import type { VoiceV3CallClock } from "../time/call-clock";
import type { AvailabilityOfferSet } from "../calendar/offer-set";
import type { PresentedOffer, SelectedAvailabilitySlot } from "../calendar/selected-slot";
import type { FindAvailabilityFailure, FindAvailabilityStatus } from "../calendar/types";
import type { SlotSelectionResolution } from "../calendar/resolve-slot-selection";
import type {
  BookingAttemptSnapshot,
  BookingFailure,
  BookingPhase,
  ConfirmedBooking,
} from "../calendar/booking-types";
import type { SchedulingClarificationRequirement } from "../time/scheduling-clarification";
import type {
  NormalizedSchedulingPreference,
  SchedulingMeaning,
} from "../time/scheduling-types";

import type {
  AppointmentLookupState,
  CancellationPhase,
  ExistingAppointment,
  ExistingAppointmentCandidateSet,
  ReschedulePhase,
} from "../calendar/appointment-management-types";
import type { AppointmentSelectionMeaning } from "../intake/appointment-selection-schema";
import type { CancellationConfirmation } from "../intake/cancellation-confirmation-schema";
import type { VoiceV3RecoveryDirective } from "../recovery/types";
import type { GoalManagerState } from "../agent/goal-manager";
import type { VoiceV3OperationsMap } from "../operations/types";
import type { EscalationCounters, VoiceV3EscalationPolicy } from "../agent/escalation";
import type { VoiceV3Capabilities } from "../agent/capability-state";
import type { VoiceV3BookingLinkCallState } from "../booking-link/types";
import type { VoiceV3CallbackCallState } from "../callback/types";
import type { BookingVerbalConfirmationStatus } from "../booking/verbal-confirmation";

export type VoiceV3Goal =
  | "UNKNOWN"
  | "GENERAL"
  | "BOOK_APPOINTMENT"
  | "RESCHEDULE_APPOINTMENT"
  | "CANCEL_APPOINTMENT"
  | "REQUEST_CALLBACK"
  | "REQUEST_TRANSFER";

export type IntakeFieldVerificationStatus =
  | "candidate"
  | "collected"
  | "verified"
  | "declined";

export interface CapturedField {
  value: string;
  source: "caller" | "business" | "runtime";
  confidence?: number;
  utteranceId?: string;
  updatedAt: string;
  revision?: number;
  verificationStatus?: IntakeFieldVerificationStatus;
}

export interface VoiceV3CallContext {
  callId: string;
  liveSessionId: string;
  createdAt: string;
  updatedAt: string;
  business: {
    timezone: string;
  };
  /** Trusted telephony metadata — not LLM-supplied. */
  telephony: {
    inboundCallerE164: string | null;
  };
  clock: VoiceV3CallClock;
  dialog: {
    activeGoal: VoiceV3Goal;
  };
  conversation?: {
    goalManager: GoalManagerState;
    closingOffered?: boolean;
    callEnding?: boolean;
  };
  operations: VoiceV3OperationsMap;
  escalation?: {
    policy: VoiceV3EscalationPolicy;
    counters: EscalationCounters;
  };
  handoff?: {
    requested: boolean;
    reason?: string;
    fallback?: string;
  };
  capabilities?: VoiceV3Capabilities;
  agent?: {
    lastSyncedStateVersion: number;
  };
  intake: {
    values: Record<string, CapturedField>;
  };
  scheduling: {
    generation: number;
    meaning?: SchedulingMeaning;
    normalized?: NormalizedSchedulingPreference | null;
    clarification?: SchedulingClarificationRequirement | null;
  };
  availability: {
    status: FindAvailabilityStatus;
    activeOfferSet: AvailabilityOfferSet | null;
    lastFailure: FindAvailabilityFailure | null;
    inFlightGeneration: number | null;
    lastDispatchedRequestKey: string | null;
    findStartedAt: string | null;
  };
  recovery: {
    active: VoiceV3RecoveryDirective | null;
    lastResolved?: VoiceV3RecoveryDirective | null;
  };
  presentation: {
    current: PresentedOffer | null;
  };
  selection: {
    selected: SelectedAvailabilitySlot | null;
    lastResolutionStatus: SlotSelectionResolution["status"] | null;
  };
  booking: {
    phase: BookingPhase;
    activeAttempt: BookingAttemptSnapshot | null;
    confirmed: ConfirmedBooking | null;
    lastFailure: BookingFailure | null;
    postBookChangeRequested: boolean;
    verbalConfirmation: BookingVerbalConfirmationStatus;
  };
  bookingLink?: VoiceV3BookingLinkCallState;
  callback?: VoiceV3CallbackCallState;
  appointmentManagement: {
    verifiedExisting: ExistingAppointment | null;
    candidateSet: ExistingAppointmentCandidateSet | null;
    pendingSelection: AppointmentSelectionMeaning | null;
    lookupState: AppointmentLookupState | null;
    lookupCompleted: boolean;
    reschedule: {
      phase: ReschedulePhase;
      attemptId: string | null;
    };
    cancellation: {
      phase: CancellationPhase;
      cancellationAttemptId: string | null;
      awaitingConfirmation: boolean;
      boundProviderEventId: string | null;
    };
    lastCancellationConfirmation: CancellationConfirmation;
  };
  runtime: {
    version: number;
  };
}

export function createInitialVoiceV3CallContext(input: {
  callId: string;
  liveSessionId: string;
  timezone: string;
  clock: VoiceV3CallClock;
  inboundCallerE164?: string | null;
  now?: Date;
}): VoiceV3CallContext {
  const now = (input.now ?? new Date()).toISOString();
  return {
    callId: input.callId,
    liveSessionId: input.liveSessionId,
    createdAt: now,
    updatedAt: now,
    business: { timezone: input.timezone },
    telephony: { inboundCallerE164: input.inboundCallerE164?.trim() || null },
    clock: input.clock,
    dialog: { activeGoal: "UNKNOWN" },
    conversation: {
      goalManager: {
        activeGoalId: null,
        pendingGoalIds: [],
        completedGoalIds: [],
        abandonedGoalIds: [],
        goals: {},
      },
      closingOffered: false,
      callEnding: false,
    },
    operations: {},
    intake: { values: {} },
    scheduling: { generation: 0, normalized: null },
    availability: {
      status: "idle",
      activeOfferSet: null,
      lastFailure: null,
      inFlightGeneration: null,
      lastDispatchedRequestKey: null,
      findStartedAt: null,
    },
    recovery: { active: null, lastResolved: null },
    presentation: { current: null },
    selection: { selected: null, lastResolutionStatus: null },
    booking: {
      phase: "NONE",
      activeAttempt: null,
      confirmed: null,
      lastFailure: null,
      postBookChangeRequested: false,
      verbalConfirmation: "NOT_REQUIRED",
    },
    appointmentManagement: {
      verifiedExisting: null,
      candidateSet: null,
      pendingSelection: null,
      lookupState: null,
      lookupCompleted: false,
      reschedule: { phase: "NONE", attemptId: null },
      cancellation: {
        phase: "NONE",
        cancellationAttemptId: null,
        awaitingConfirmation: false,
        boundProviderEventId: null,
      },
      lastCancellationConfirmation: "NONE",
    },
    runtime: { version: 0 },
  };
}
