import type { CalendlyCalendar, AvailableSlot } from "./calendly-calendar";
import type { ReceptionistBookingCalendar } from "./receptionist-booking-calendar";
import type { BookingOperation } from "./booking-operation";
import {
  isFrontDeskProfile as isFrontDeskProfileFromConfig,
  usesFrontDeskRealtimeVoicePipeline,
} from "@/lib/voice/frontdesk/agent-config";
import type { RealEstateCallState } from "@/lib/voice/real-estate/types";
import type { CompiledRealEstateFrontDesk } from "@/lib/voice/real-estate/compile/types";
import type { ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";
import type { ReceptionistWorkflowSnapshot } from "./receptionist/workflow-types";
import type { OutboundRealtimeTurnDetection } from "../realtime-turn-config";

export type BookingStatus = "pending" | "confirmed";

export type FrontDeskBookingState = {
  status: BookingStatus;
  slotId?: string;
  providerEventId?: string;
  appointmentId?: string;
  bookedTimeLabel?: string;
};

export type FrontDeskBookingReceipt = {
  slotId: string;
  bookedTimeLabel: string;
  providerEventId?: string;
  appointmentId?: string;
};

export type FrontDeskUserData = {
  workspaceId: string;
  agentId: string;
  callId: string;
  businessName: string;
  timezone: string;
  /** Configured booking provider calendar adapter (Calendly today; others via same interface). */
  cal: ReceptionistBookingCalendar & CalendlyCalendar;
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
  /** Generic receptionist compiled snapshot from wizard UI. */
  receptionistCompiled?: ReceptionistCompiledSnapshot;
  /** Collected caller fields for generic receptionist (field manifest). */
  receptionistFields?: Record<string, string>;
  /** Message recorded this call — block duplicate message/collection loops. */
  receptionistMessageTaken?: boolean;
  /** Field collection task finished — parent should not re-acknowledge fields. */
  receptionistFieldCollectionComplete?: boolean;
  /** Caller fields were acknowledged during collection (operational flag). */
  receptionistFieldsAcknowledged?: boolean;
  agentConfigVersion?: number;
  agentVersionId?: string;
  /** @deprecated Prefer booking.status === "confirmed". */
  bookingComplete?: boolean;
  bookedTimeLabel?: string;
  pendingSlotId?: string;
  /** Authoritative receipt after runtime-confirmed Calendly write. */
  bookingReceipt?: FrontDeskBookingReceipt;
  /** Prevents duplicate booking confirmation SMS on retry or reschedule. */
  bookingConfirmationSmsSent?: boolean;
  /** True while schedule_appointment is writing to Calendly. */
  bookingInProgress?: boolean;
  /** Deterministic booking operation lifecycle (collecting_email → writing_calendar → terminal). */
  bookingOperation?: BookingOperation;
  /** Promise waiter for inline email collection during schedule_appointment. */
  bookingEmailWaiter?: {
    resolve: (result: { email: string; declined: boolean }) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  /** IntakeSequenceCollectionTask is running inside a tool — blocks duplicate collect_required_fields. */
  intakeSequenceActive?: boolean;
  /** Background CRM prefetch started for caller ANI. */
  callerContactPrefetched?: boolean;
  /** speakBeforeTaskHandoff delivered — parent runAsyncWorkWithBridge skips duplicate line. */
  asyncWorkBridgeDelivered?: boolean;
  /** Brief ack for the next intake field task onEnter (non-interactive). */
  intakeTransitionPhrase?: string;
  /** Parent spoke the first collection question before task handoff — skip duplicate onEnter. */
  receptionistFieldCollectionPrefaceSpoken?: boolean;
  /** BookingIntakeTask is running — authoritative booking phase is intake. */
  bookingIntakeActive?: boolean;
  /** Instrumentation for task boundary first-audio metrics. */
  activeTaskInstrumentation?: {
    taskId: string;
    taskType: string;
    firstAudioLogged?: boolean;
  };
  /** Runtime-owned receptionist workflow conductor state. */
  receptionistWorkflow?: ReceptionistWorkflowSnapshot;
  /** Slot cache for booking tools + runtime orchestrator (shared reference). */
  receptionistSlotsMap?: Map<string, AvailableSlot>;
  /** All receptionist tool names registered for this session. */
  receptionistToolNames?: string[];
  /** Full tool defs for runtime tool-surface filtering via updateTools. */
  receptionistToolDefs?: unknown[];
  /** Prevents concurrent runtime field processing for the same transcript. */
  collectionFieldProcessing?: boolean;
  /** Prevents concurrent runtime slot pick/confirm for the same transcript. */
  bookingTurnProcessing?: boolean;
  /** Partial US phone digits while activeField is phone — not persisted until 10 digits. */
  collectionPhoneDigitsBuffer?: string;
  /** Partial fragments for spelled names, email, address, etc. keyed by field id. */
  collectionFieldFragmentBuffers?: Record<string, string>;
  /** Runtime-direct schedule_appointment in progress. */
  bookingCommitInFlight?: boolean;
  /** LiveKit TaskGroup owns collection — disable main-session transcript handler. */
  receptionistCollectionTaskGroupActive?: boolean;
  /** Call is in closing phase — block duplicate end_call. */
  callClosing?: boolean;
  /** Base inbound Realtime turn_detection (semantic/server) for runtime-owned toggles. */
  inboundRealtimeTurnDetection?: OutboundRealtimeTurnDetection;
  /** Whether create_response is currently false (runtime owns replies during collection). */
  collectionRuntimeOwnedTurnDetection?: boolean;
  /** Active controlled generation id for diagnostics. */
  collectionActiveGenerationId?: string;
  /** Runtime collection substate: PROMPTING | LISTENING | PROCESSING. */
  collectionFieldPhase?: "PROMPTING" | "LISTENING" | "PROCESSING";
  /** Field id whose question was last emitted to the caller. */
  collectionPromptedFieldId?: string;
  /** Watchdog: active field receiving repeated non-field utterances. */
  collectionStuckFieldId?: string;
  collectionStuckNonFieldTurns?: number;
  /** Field ids persisted via tools — chat backfill must not overwrite these values. */
  authoritativeFieldIds?: string[];
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
  userData.bookingInProgress = false;
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
