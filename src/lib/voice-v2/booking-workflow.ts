/**
 * Deterministic Voice V2 post-intake scheduling transition (in-memory only).
 * No FIND/BOOK/Graph changes — stage authority for tool responses + prompts.
 */

import type { VoiceV2BookingStrategy } from "./booking-strategy";
import type { IntakeFieldKey, IntakeReadinessResult, VoiceV2CallContext } from "./intake/types";

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

export function applyIntakeWorkflowSignals(
  workflow: VoiceV2BookingWorkflow,
  input: {
    raw: Record<string, unknown>;
    savedKeys: IntakeFieldKey[];
    schedulingDateFromSave?: string | null;
  },
): VoiceV2BookingWorkflow {
  const w = { ...workflow };
  const signal = parseWorkflowSignal(input.raw);
  if (signal === "prefer_callback") w.callbackRequested = true;
  if (signal === "cancel_booking") w.bookingCancelled = true;
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
}): VoiceV2NextStage {
  const w = input.workflow;
  const strategy = input.bookingStrategy ?? "MICROSOFT_365";
  if (w.bookingConfirmed) return "BOOKING_CONFIRMED";
  if (w.callerRequestFinalized) return "COMPLETE";
  if (w.callbackRequested) return "CALLBACK_REQUESTED";
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
  if (input.hasActiveOfferSet) return "OFFER_SLOTS";
  if (w.requestedDate) return "FIND_AVAILABILITY";
  return "COLLECT_SCHEDULING_PREFERENCE";
}

export function allowedNextActionsForStage(stage: VoiceV2NextStage): string[] {
  switch (stage) {
    case "COLLECT_REQUIRED_INTAKE":
      return ["voice_v2_save_intake_fields"];
    case "COLLECT_SCHEDULING_PREFERENCE":
      return ["conversational_collect_date", "voice_v2_save_intake_fields", "scheduling_preference"];
    case "FIND_AVAILABILITY":
      return ["voice_v2_find_availability"];
    case "OFFER_SLOTS":
      return ["voice_v2_book_offered_slot", "voice_v2_find_availability"];
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
      return "Intake complete. Ask what day works for the appointment. Do not close with callback or follow-up.";
    case "FIND_AVAILABILITY":
      return "Intake complete and date is known. Acknowledge the date briefly, then call voice_v2_find_availability now. Do not ask for the day again. Do not callback-close.";
    case "FINALIZE_CALLER_REQUEST":
      return "You have enough to send this to the team. Call voice_v2_finalize_caller_request. Do not say the appointment is confirmed or booked.";
    case "SEND_BOOKING_LINK":
      return "Offer to text the configured booking link. After the caller agrees to SMS, call voice_v2_send_booking_link with verbal_sms_consent true. Do not say they are booked or confirmed.";
    case "OFFER_SLOTS":
      return "Offer returned slots only. When caller picks one, call voice_v2_book_offered_slot.";
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
}): Record<string, unknown> {
  const strategy =
    input.bookingStrategy ?? (input.voiceV2PstnLiveBooking ? "MICROSOFT_365" : "NONE");
  const nextStage = deriveVoiceV2NextStage({
    workflow: input.workflow,
    readiness: input.readiness,
    hasActiveOfferSet: input.hasActiveOfferSet ?? false,
    bookingStrategy: strategy,
  });
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
  };

  if (workflow.requestedDate) {
    payload.known_scheduling_preference = { requested_date: workflow.requestedDate };
  }

  if (booking_continue_required) {
    payload.forbidden_actions = [...VOICE_V2_FORBIDDEN_WHEN_BOOKING_CONTINUE];
    payload.continue = true;
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

  const hasOffer =
    Boolean(input.ctx.currentOfferSet?.offerSetId) &&
    (input.ctx.currentOfferSet?.slotIds?.length ?? 0) > 0;

  const strategy =
    input.bookingStrategy ??
    input.ctx.capabilities?.bookingStrategy ??
    (input.voiceV2PstnLiveBooking ? "MICROSOFT_365" : "NONE");
  workflow.nextStage = deriveVoiceV2NextStage({
    workflow,
    readiness: input.readiness,
    hasActiveOfferSet: hasOffer,
    bookingStrategy: strategy,
  });

  return mergeWorkflowIntoContext(input.ctx, workflow);
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
