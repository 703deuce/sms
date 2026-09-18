/**
 * Deterministic Voice V2 post-intake scheduling transition (in-memory only).
 * No FIND/BOOK/Graph changes — stage authority for tool responses + prompts.
 */

import type { VoiceV2BookingStrategy } from "./booking-strategy";
import { applyDialogAndWorkflowPrecedence, dialogFromContext, isActiveBookingGoal } from "./dialog-goal";
import type { IntakeFieldKey, IntakeReadinessResult, VoiceV2CallContext } from "./intake/types";
import {
  syncWorkflowRequestedDateFromScheduling,
  type VoiceV2SchedulingPreference,
} from "./scheduling-preference-state";
import {
  applyQualificationStageOverride,
  qualificationWorkflowExtras,
} from "./qualification-workflow";

export type VoiceV2NextStage =
  | "COLLECT_REQUIRED_INTAKE"
  | "COLLECT_SCHEDULING_PREFERENCE"
  | "FIND_AVAILABILITY"
  | "OFFER_SLOTS"
  | "BOOK_SELECTED_SLOT"
  | "BOOKING_CONFIRMED"
  | "FINALIZE_CALLER_REQUEST"
  | "SEND_BOOKING_LINK"
  | "CALLBACK_REQUESTED"
  | "HANDOFF_REQUIRED"
  | "COMPLETE";

export type VoiceV2WorkflowSignal = "prefer_callback" | "cancel_booking";

export interface VoiceV2BookingWorkflow {
  bookingIntentActive: boolean;
  callbackRequested: boolean;
  /** Caller explicitly requested callback-only — not soft prefer_callback from the model. */
  explicitCallbackRequested?: boolean;
  bookingCancelled: boolean;
  bookingConfirmed: boolean;
  /** Caller request accepted into durable follow-up (message or appointment request). */
  callerRequestFinalized: boolean;
  /** Trusted booking link SMS accepted by messaging provider for this call. */
  bookingLinkSent: boolean;
  deliveryDestinationE164?: string | null;
  /** YYYY-MM-DD when caller or FIND supplied a date */
  requestedDate: string | null;
  /** Last date passed to FIND (dedupe guidance) */
  lastFindRequestedDate: string | null;
  nextStage: VoiceV2NextStage;
}

export const VOICE_V2_FORBIDDEN_WHEN_BOOKING_CONTINUE = [
  "callback_close",
  "follow_up_only",
  "message_taking_terminal",
  "live_booking_unavailable_claim",
  "legacy_voice_ai_booking_turn",
] as const;

export function defaultVoiceV2BookingWorkflow(): VoiceV2BookingWorkflow {
  return {
    bookingIntentActive: false,
    callbackRequested: false,
    explicitCallbackRequested: false,
    bookingCancelled: false,
    bookingConfirmed: false,
    callerRequestFinalized: false,
    bookingLinkSent: false,
    deliveryDestinationE164: null,
    requestedDate: null,
    lastFindRequestedDate: null,
    nextStage: "COLLECT_REQUIRED_INTAKE",
  };
}

export function workflowFromContext(ctx: VoiceV2CallContext): VoiceV2BookingWorkflow {
  return ctx.bookingWorkflow ?? defaultVoiceV2BookingWorkflow();
}

/** Align workflow flags with durable dialog goal before stage derivation. */
export function workflowFromContextWithDialog(ctx: VoiceV2CallContext): VoiceV2BookingWorkflow {
  let workflow = syncWorkflowRequestedDateFromScheduling(
    workflowFromContext(ctx),
    ctx.schedulingPreference,
  );
  const goal = dialogFromContext(ctx).activeGoal;
  if (isActiveBookingGoal(goal)) {
    workflow = { ...workflow, bookingIntentActive: true };
  }
  return workflow;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeRequestedDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return DATE_RE.test(s) ? s : null;
}

export function parseWorkflowSignal(raw: Record<string, unknown>): VoiceV2WorkflowSignal | null {
  const v = String(raw.workflow_signal || raw.workflowSignal || "").trim();
  if (v === "prefer_callback" || v === "callback") return "prefer_callback";
  if (v === "cancel_booking" || v === "cancel") return "cancel_booking";
  return null;
}

function logIgnoredLegacyWorkflowSignal(raw: Record<string, unknown>) {
  const signal = parseWorkflowSignal(raw);
  if (!signal) return;
  console.info(
    `VOICE_LEGACY_WORKFLOW_SIGNAL_IGNORED ${JSON.stringify({
      workflow_signal: signal,
      note: "workflow_signal is not authoritative; use explicit fact fields with caller evidence",
    })}`,
  );
}

/** Caller-grounded cancel only — never from legacy workflow_signal alone. */
export function applyCallerGroundedCancelFromRaw(
  workflow: VoiceV2BookingWorkflow,
  raw: Record<string, unknown>,
): VoiceV2BookingWorkflow {
  const w = { ...workflow };
  logIgnoredLegacyWorkflowSignal(raw);
  const evidence = String(raw.intent_evidence || raw.cancel_evidence || "").trim();
  const explicitCancel =
    (raw.cancel_booking_requested === true || raw.cancelBookingRequested === true) &&
    evidence.length > 0;
  if (explicitCancel) {
    w.bookingCancelled = true;
  }
  return w;
}

export function guardBookingCancelDuringActiveBooking(input: {
  workflow: VoiceV2BookingWorkflow;
  dialogActiveGoal: import("./dialog-goal").VoiceDialogGoal;
  explicitCancelEvidence: boolean;
}): VoiceV2BookingWorkflow {
  const w = { ...input.workflow };
  if (
    w.bookingCancelled &&
    !input.explicitCancelEvidence &&
    (input.dialogActiveGoal === "BOOK_APPOINTMENT" ||
      input.dialogActiveGoal === "CHANGE_APPOINTMENT" ||
      w.bookingIntentActive)
  ) {
    console.info(
      `VOICE_WORKFLOW_CANCEL_GUARDED ${JSON.stringify({
        reason: "cancel_without_caller_grounded_evidence",
        active_goal: input.dialogActiveGoal,
      })}`,
    );
    w.bookingCancelled = false;
  }
  return w;
}

export function applyIntakeWorkflowSignals(
  workflow: VoiceV2BookingWorkflow,
  input: {
    raw: Record<string, unknown>;
    savedKeys: IntakeFieldKey[];
    schedulingDateFromSave?: string | null;
  },
): VoiceV2BookingWorkflow {
  let w = { ...workflow };
  w = applyCallerGroundedCancelFromRaw(w, input.raw);
  if (input.raw.booking_intent_active === true || input.raw.bookingIntentActive === true) {
    w.bookingIntentActive = true;
  }
  if (input.savedKeys.includes("service_reason")) {
    w.bookingIntentActive = true;
  }
  const pref = (input.raw.scheduling_preference || input.raw.schedulingPreference) as
    | { requested_date?: string; requestedDate?: string }
    | undefined;
  const fromPref = normalizeRequestedDate(pref?.requested_date ?? pref?.requestedDate);
  if (fromPref) w.requestedDate = fromPref;
  if (input.schedulingDateFromSave) w.requestedDate = input.schedulingDateFromSave;
  return w;
}

export function isBookingWorkflowTerminal(w: VoiceV2BookingWorkflow): boolean {
  return (
    w.bookingConfirmed ||
    w.bookingCancelled ||
    w.callbackRequested ||
    w.callerRequestFinalized ||
    w.bookingLinkSent ||
    w.nextStage === "BOOKING_CONFIRMED" ||
    w.nextStage === "COMPLETE" ||
    w.nextStage === "CALLBACK_REQUESTED"
  );
}

export function evaluateBookingContinueRequired(input: {
  voiceV2PstnLiveBooking: boolean;
  bookingStrategy?: VoiceV2BookingStrategy;
  workflow: VoiceV2BookingWorkflow;
  readiness: IntakeReadinessResult;
}): boolean {
  const strategy = input.bookingStrategy ?? (input.voiceV2PstnLiveBooking ? "MICROSOFT_365" : "NONE");
  if (strategy === "REQUEST_ONLY") {
    if (!input.workflow.bookingIntentActive) return false;
    if (isBookingWorkflowTerminal(input.workflow)) return false;
    if (input.readiness.missingForRecord.length > 0) return true;
    if (!input.workflow.requestedDate) return true;
    return !input.workflow.callerRequestFinalized;
  }
  if (strategy === "SEND_LINK") {
    if (!input.workflow.bookingIntentActive) return false;
    if (isBookingWorkflowTerminal(input.workflow)) return false;
    if (input.workflow.bookingLinkSent) return false;
    return true;
  }
  if (!input.voiceV2PstnLiveBooking) return false;
  if (!input.workflow.bookingIntentActive) return false;
  if (isBookingWorkflowTerminal(input.workflow)) return false;
  if (input.readiness.missingBeforeBooking.length > 0) return false;
  return true;
}

export function deriveVoiceV2NextStage(input: {
  workflow: VoiceV2BookingWorkflow;
  readiness: IntakeReadinessResult;
  hasActiveOfferSet: boolean;
  bookingStrategy?: VoiceV2BookingStrategy;
  schedulingPreference?: VoiceV2SchedulingPreference;
  /** Canonical slot pick from runtime — not model memory. */
  selectedSlotId?: string | null;
}): VoiceV2NextStage {
  const w = {
    ...input.workflow,
    requestedDate:
      input.workflow.requestedDate ??
      normalizeRequestedDate(input.schedulingPreference?.requestedDate),
  };
  const strategy = input.bookingStrategy ?? "MICROSOFT_365";
  if (w.bookingConfirmed) return "BOOKING_CONFIRMED";
  if (w.callerRequestFinalized) return "COMPLETE";
  const callbackBlocksBooking =
    w.callbackRequested &&
    (w.explicitCallbackRequested === true ||
      (!w.bookingIntentActive && !w.requestedDate));
  if (callbackBlocksBooking) return "CALLBACK_REQUESTED";
  if (w.bookingCancelled) return "COMPLETE";
  if (strategy === "NONE") {
    if (input.readiness.missingForRecord.length > 0) return "COLLECT_REQUIRED_INTAKE";
    return "FINALIZE_CALLER_REQUEST";
  }
  if (strategy === "REQUEST_ONLY") {
    if (!w.bookingIntentActive) return "COLLECT_REQUIRED_INTAKE";
    if (input.readiness.missingForRecord.length > 0) return "COLLECT_REQUIRED_INTAKE";
    if (!w.requestedDate) return "COLLECT_SCHEDULING_PREFERENCE";
    return "FINALIZE_CALLER_REQUEST";
  }
  if (strategy === "SEND_LINK") {
    if (!w.bookingIntentActive) return "COLLECT_REQUIRED_INTAKE";
    if (w.bookingLinkSent) return "COMPLETE";
    if (input.readiness.missingForRecord.length > 0) return "COLLECT_REQUIRED_INTAKE";
    return "SEND_BOOKING_LINK";
  }
  if (!w.bookingIntentActive) return "COLLECT_REQUIRED_INTAKE";
  if (input.readiness.missingBeforeBooking.length > 0) return "COLLECT_REQUIRED_INTAKE";
  if (input.hasActiveOfferSet) {
    const slot = String(input.selectedSlotId || "").trim();
    if (slot) return "BOOK_SELECTED_SLOT";
    return "OFFER_SLOTS";
  }
  if (w.requestedDate) return "FIND_AVAILABILITY";
  return "COLLECT_SCHEDULING_PREFERENCE";
}

export function allowedNextActionsForStage(stage: VoiceV2NextStage): string[] {
  switch (stage) {
    case "COLLECT_REQUIRED_INTAKE":
      return ["voice_v2_save_intake_fields"];
    case "COLLECT_SCHEDULING_PREFERENCE":
      return ["voice_v2_save_intake_fields"];
    case "FIND_AVAILABILITY":
      return ["voice_v2_find_availability"];
    case "OFFER_SLOTS":
      return ["voice_v2_book_offered_slot"];
    case "BOOK_SELECTED_SLOT":
      return ["voice_v2_book_offered_slot"];
    case "BOOKING_CONFIRMED":
      return [];
    case "FINALIZE_CALLER_REQUEST":
      return ["voice_v2_finalize_caller_request"];
    case "SEND_BOOKING_LINK":
      return ["voice_v2_send_booking_link"];
    case "CALLBACK_REQUESTED":
      return ["callback_path"];
    case "HANDOFF_REQUIRED":
      return ["transfer"];
    case "COMPLETE":
      return [];
    default:
      return [];
  }
}

export function deriveRequiredActionForStage(
  stage: VoiceV2NextStage,
  workflow: VoiceV2BookingWorkflow,
  readiness: IntakeReadinessResult,
  opts: { hasActiveOfferSet: boolean; knownRequestedDate: string | null },
): string | null {
  if (workflow.bookingConfirmed) return null;
  if (stage === "FIND_AVAILABILITY" && opts.knownRequestedDate && readiness.missingBeforeBooking.length === 0) {
    return "voice_v2_find_availability";
  }
  if (stage === "BOOK_SELECTED_SLOT" && opts.hasActiveOfferSet && workflow.requestedDate) {
    return "voice_v2_book_offered_slot";
  }
  return null;
}

export function runtimeHintForStage(
  stage: VoiceV2NextStage,
  workflow?: VoiceV2BookingWorkflow,
): string {
  switch (stage) {
    case "COLLECT_REQUIRED_INTAKE":
      if (workflow?.requestedDate) {
        return `Caller already gave a scheduling preference (${workflow.requestedDate}). Ask only for missing intake fields. Do not ask for the day again.`;
      }
      return "";
    case "COLLECT_SCHEDULING_PREFERENCE":
      if (workflow?.requestedDate) {
        return `Scheduling date ${workflow.requestedDate} is already captured. Call voice_v2_find_availability when intake is complete.`;
      }
      return "Intake complete. Ask what day works for the appointment. Do not close with callback or follow-up.";
    case "FIND_AVAILABILITY":
      return "Intake complete and date is known. Acknowledge briefly; the runtime runs calendar FIND when required_action is voice_v2_find_availability. Do not ask for the day again. Do not callback-close.";
    case "BOOK_SELECTED_SLOT":
      return "Caller selected a canonical slot. The runtime executes BOOK when required_action is voice_v2_book_offered_slot. Do not call FIND again.";
    case "FINALIZE_CALLER_REQUEST":
      return "You have enough to send this to the team. Call voice_v2_finalize_caller_request. Do not say the appointment is confirmed or booked.";
    case "SEND_BOOKING_LINK":
      return "Offer to text the configured booking link. After the caller agrees to SMS, call voice_v2_send_booking_link with verbal_sms_consent true. Do not say they are booked or confirmed.";
    case "OFFER_SLOTS":
      return "Open times are already on the table. When the caller picks one (for example three PM), call voice_v2_book_offered_slot with offer_set_id and matching selected_slot_id. Do not call find again or re-ask the day unless they want a different date.";
    case "CALLBACK_REQUESTED":
      return "Caller requested callback. Callback path allowed.";
    case "COMPLETE":
      return "Booking cancelled or finished.";
    default:
      return "";
  }
}

export function mergeWorkflowIntoContext(
  ctx: VoiceV2CallContext,
  workflow: VoiceV2BookingWorkflow,
): VoiceV2CallContext {
  return { ...ctx, bookingWorkflow: workflow };
}

export function buildWorkflowToolPayload(input: {
  voiceV2PstnLiveBooking: boolean;
  bookingStrategy?: VoiceV2BookingStrategy;
  workflow: VoiceV2BookingWorkflow;
  readiness: IntakeReadinessResult;
  hasActiveOfferSet?: boolean;
  ctx?: VoiceV2CallContext;
}): Record<string, unknown> {
  const strategy =
    input.bookingStrategy ?? (input.voiceV2PstnLiveBooking ? "MICROSOFT_365" : "NONE");
  let nextStage = deriveVoiceV2NextStage({
    workflow: input.workflow,
    readiness: input.readiness,
    hasActiveOfferSet: input.hasActiveOfferSet ?? false,
    bookingStrategy: strategy,
    schedulingPreference: input.ctx?.schedulingPreference,
    selectedSlotId: input.ctx?.bookingState?.selectedSlotId,
  });
  if (input.ctx) {
    nextStage = applyQualificationStageOverride(nextStage, input.ctx, strategy);
  }
  const workflow = { ...input.workflow, nextStage };
  const booking_continue_required = evaluateBookingContinueRequired({
    voiceV2PstnLiveBooking: input.voiceV2PstnLiveBooking,
    bookingStrategy: strategy,
    workflow,
    readiness: input.readiness,
  });

  const payload: Record<string, unknown> = {
    voice_v2_next_stage: nextStage,
    booking_continue_required,
    allowed_next_actions: allowedNextActionsForStage(nextStage),
    runtime_hint: runtimeHintForStage(nextStage, workflow),
    active_goal: input.ctx?.dialog?.activeGoal ?? null,
  };

  const knownDate =
    workflow.requestedDate ??
    normalizeRequestedDate(input.ctx?.schedulingPreference?.requestedDate);
  if (knownDate) {
    payload.known_scheduling_preference = { requested_date: knownDate };
  }
  const requiredAction = deriveRequiredActionForStage(nextStage, workflow, input.readiness, {
    hasActiveOfferSet: input.hasActiveOfferSet ?? false,
    knownRequestedDate: knownDate,
  });
  if (requiredAction) payload.required_action = requiredAction;

  if (booking_continue_required) {
    payload.forbidden_actions = [...VOICE_V2_FORBIDDEN_WHEN_BOOKING_CONTINUE];
    payload.continue = true;
  }

  if (input.ctx) {
    Object.assign(payload, qualificationWorkflowExtras(input.ctx));
  }

  return payload;
}

/** After intake save — single transition evaluator. */
export function transitionAfterIntakeSave(input: {
  ctx: VoiceV2CallContext;
  raw: Record<string, unknown>;
  savedKeys: IntakeFieldKey[];
  readiness: IntakeReadinessResult;
  voiceV2PstnLiveBooking: boolean;
  bookingStrategy?: VoiceV2BookingStrategy;
}): VoiceV2CallContext {
  let workflow = applyIntakeWorkflowSignals(workflowFromContext(input.ctx), {
    raw: input.raw,
    savedKeys: input.savedKeys,
    schedulingDateFromSave: normalizeRequestedDate(
      ((input.raw.scheduling_preference || input.raw.schedulingPreference) as {
        requested_date?: string;
      })?.requested_date,
    ),
  });
  const dialogApplied = applyDialogAndWorkflowPrecedence({
    ctx: input.ctx,
    raw: input.raw,
    savedKeys: input.savedKeys,
    workflow,
  });
  workflow = dialogApplied.workflow;
  let ctx = dialogApplied.ctx;

  if (isActiveBookingGoal(dialogFromContext(ctx).activeGoal)) {
    workflow = { ...workflow, bookingIntentActive: true };
  }
  const cancelEvidence = String(input.raw.intent_evidence || "").trim().length > 0;
  workflow = guardBookingCancelDuringActiveBooking({
    workflow,
    dialogActiveGoal: dialogFromContext(ctx).activeGoal,
    explicitCancelEvidence:
      cancelEvidence &&
      (input.raw.cancel_booking_requested === true || input.raw.cancelBookingRequested === true),
  });
  ctx = mergeWorkflowIntoContext(ctx, workflow);

  const hasOffer =
    Boolean(ctx.currentOfferSet?.offerSetId) &&
    (ctx.currentOfferSet?.slotIds?.length ?? 0) > 0;

  const strategy =
    input.bookingStrategy ??
    input.ctx.capabilities?.bookingStrategy ??
    (input.voiceV2PstnLiveBooking ? "MICROSOFT_365" : "NONE");
  workflow.nextStage = deriveVoiceV2NextStage({
    workflow,
    readiness: input.readiness,
    hasActiveOfferSet: hasOffer,
    bookingStrategy: strategy,
    schedulingPreference: ctx.schedulingPreference,
    selectedSlotId: ctx.bookingState?.selectedSlotId,
  });

  return mergeWorkflowIntoContext(ctx, workflow);
}

export function transitionAfterBookingLinkSent(
  ctx: VoiceV2CallContext,
  destinationE164: string,
): VoiceV2CallContext {
  const workflow = {
    ...workflowFromContext(ctx),
    bookingIntentActive: true,
    bookingLinkSent: true,
    deliveryDestinationE164: destinationE164,
    nextStage: "COMPLETE" as VoiceV2NextStage,
  };
  return mergeWorkflowIntoContext(ctx, workflow);
}

export function transitionAfterCallerRequestFinalized(ctx: VoiceV2CallContext): VoiceV2CallContext {
  const workflow = {
    ...workflowFromContext(ctx),
    callerRequestFinalized: true,
    nextStage: "COMPLETE" as VoiceV2NextStage,
  };
  return mergeWorkflowIntoContext(ctx, workflow);
}

export function transitionAfterFind(input: {
  ctx: VoiceV2CallContext;
  requestedDate: string;
  offerSetId: string;
  slotIds: string[];
}): VoiceV2CallContext {
  const workflow = {
    ...workflowFromContext(input.ctx),
    bookingIntentActive: true,
    requestedDate: input.requestedDate,
    lastFindRequestedDate: input.requestedDate,
    nextStage: "OFFER_SLOTS" as VoiceV2NextStage,
  };
  return {
    ...mergeWorkflowIntoContext(input.ctx, workflow),
    currentOfferSet: { offerSetId: input.offerSetId, slotIds: input.slotIds },
  };
}

export function transitionAfterBookingConfirmed(ctx: VoiceV2CallContext): VoiceV2CallContext {
  const workflow = {
    ...workflowFromContext(ctx),
    bookingIntentActive: true,
    bookingConfirmed: true,
    nextStage: "BOOKING_CONFIRMED" as VoiceV2NextStage,
  };
  return mergeWorkflowIntoContext(ctx, workflow);
}
