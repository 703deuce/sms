import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RuleEvaluation } from "../state/call-rules";
import type { VoiceV3RecoveryCode, VoiceV3RecoveryDirective } from "./types";
import { mapProviderFailureToRecoveryCode } from "../operations/provider-failure-map";

const FIND_PENDING_TIMEOUT_MS = 45_000;

function newDirective(input: {
  ctx: VoiceV3CallContext;
  code: VoiceV3RecoveryCode;
  userRecoverable: boolean;
  safeAgentMessage: string;
  missingFieldKey?: string;
  relatedAction?: string;
  schedulingGeneration?: number;
  offerSetId?: string;
  at: Date;
}): VoiceV3RecoveryDirective {
  return {
    id: `rec_${input.ctx.callId}_${input.at.getTime()}_${input.code}`,
    callId: input.ctx.callId,
    code: input.code,
    status: "ACTIVE",
    userRecoverable: input.userRecoverable,
    missingFieldKey: input.missingFieldKey,
    relatedAction: input.relatedAction,
    safeAgentMessage: input.safeAgentMessage,
    createdAt: input.at.toISOString(),
    schedulingGeneration:
      input.schedulingGeneration ?? input.ctx.scheduling.generation,
    offerSetId:
      input.offerSetId ?? input.ctx.availability.activeOfferSet?.offerSetId,
  };
}

function fieldLabel(config: VoiceV3AgentConfig, key: string): string {
  return config.intakeFields.find((f) => f.key === key)?.label ?? key;
}

function prioritizeMissingField(
  missing: string[],
  config: VoiceV3AgentConfig,
): string | null {
  if (missing.length === 0) return null;
  const order = config.intakeFields.map((f) => f.key);
  for (const key of order) {
    if (missing.includes(key)) return key;
  }
  return missing[0] ?? null;
}

/**
 * Deterministic recovery from authoritative CallContext + rules (not Live memory).
 */
export function evaluateVoiceV3Recovery(input: {
  ctx: VoiceV3CallContext;
  rules: VoiceV3RuleEvaluation;
  config: VoiceV3AgentConfig;
  now?: Date;
}): VoiceV3RecoveryDirective | null {
  const ctx = input.ctx;
  const rules = input.rules;
  const config = input.config;
  const at = input.now ?? new Date();
  const goal = ctx.dialog.activeGoal;

  const findStartedAt = ctx.availability.findStartedAt;
  if (
    ctx.availability.status === "pending" &&
    findStartedAt &&
    at.getTime() - Date.parse(findStartedAt) > FIND_PENDING_TIMEOUT_MS
  ) {
    return newDirective({
      ctx,
      code: "ASYNC_ACTION_TIMED_OUT",
      userRecoverable: false,
      relatedAction: "FIND_AVAILABILITY",
      safeAgentMessage:
        "Availability lookup took too long and did not complete. Do not keep saying you are checking. Tell the caller naturally you are having trouble accessing the schedule right now and offer to try again or take a message.",
      at,
    });
  }

  if (ctx.availability.status === "failed" && ctx.availability.lastFailure) {
    const reason = ctx.availability.lastFailure.reason;
    const code: VoiceV3RecoveryCode =
      reason === "configuration_missing"
        ? "MICROSOFT_AUTH_FAILED"
        : mapProviderFailureToRecoveryCode(reason);
    return newDirective({
      ctx,
      code,
      userRecoverable: false,
      relatedAction: "FIND_AVAILABILITY",
      safeAgentMessage:
        "Calendar availability could not be loaded. Do not invent open times. Do not imply you are still checking unless a new lookup actually started. Explain briefly that the schedule is temporarily unavailable and ask how the caller would like to proceed.",
      at,
    });
  }

  if (ctx.appointmentManagement.cancellation.phase === "CANCELLATION_OUTCOME_UNKNOWN") {
    return newDirective({
      ctx,
      code: "CANCELLATION_OUTCOME_UNKNOWN",
      userRecoverable: false,
      relatedAction: "CANCEL_APPOINTMENT",
      safeAgentMessage:
        "Cancellation may or may not have completed. Do not tell the caller it failed or succeeded until reconciled. Explain you are confirming with the schedule system.",
      at,
    });
  }

  if (ctx.appointmentManagement.reschedule.phase === "RESCHEDULE_OUTCOME_UNKNOWN") {
    return newDirective({
      ctx,
      code: "RESCHEDULE_OUTCOME_UNKNOWN",
      userRecoverable: false,
      relatedAction: "RESCHEDULE_APPOINTMENT",
      safeAgentMessage:
        "Reschedule may or may not have completed. Do not claim success or failure until reconciled with the calendar.",
      at,
    });
  }

  if (ctx.booking.lastFailure) {
    const uncertain = ctx.booking.phase === "BOOKING_OUTCOME_UNKNOWN";
    return newDirective({
      ctx,
      code: uncertain ? "BOOKING_OUTCOME_UNKNOWN" : "MICROSOFT_TEMPORARY_FAILURE",
      userRecoverable: false,
      relatedAction: "BOOK_APPOINTMENT",
      safeAgentMessage:
        "The booking attempt did not complete successfully. Do not tell the caller they are booked. Explain you need a moment to confirm or try again.",
      at,
    });
  }

  if (
    goal === "BOOK_APPOINTMENT" &&
    ctx.availability.status === "ready" &&
    ctx.availability.activeOfferSet?.slots.length &&
    !rules.slotSelected &&
    ctx.selection.lastResolutionStatus !== "AMBIGUOUS" &&
    ctx.selection.lastResolutionStatus !== "NOT_IN_OFFER_SET"
  ) {
    return newDirective({
      ctx,
      code: "SLOT_SELECTION_REQUIRED",
      userRecoverable: true,
      relatedAction: "SELECT_SLOT",
      safeAgentMessage:
        "Availability is ready but the caller has not selected a slot from the authoritative offer set. Present or clarify the available times; do not claim booking is complete.",
      at,
    });
  }

  if (ctx.selection.lastResolutionStatus === "AMBIGUOUS") {
    return newDirective({
      ctx,
      code: "SLOT_SELECTION_AMBIGUOUS",
      userRecoverable: true,
      relatedAction: "SELECT_SLOT",
      safeAgentMessage:
        "The caller's time choice did not map to a single offered slot. Ask which specific time they want from the authoritative options already available.",
      at,
    });
  }

  if (ctx.selection.lastResolutionStatus === "NOT_IN_OFFER_SET") {
    return newDirective({
      ctx,
      code: "SLOT_NOT_AVAILABLE",
      userRecoverable: true,
      relatedAction: "FIND_AVAILABILITY",
      safeAgentMessage:
        "The requested time is not in the current authoritative offer set. Do not claim it is available. Offer to check other times or present the available options.",
      at,
    });
  }

  const hasAuthoritativeOfferSlots =
    ctx.availability.status === "ready" &&
    (ctx.availability.activeOfferSet?.slots.length ?? 0) > 0;

  if (
    !hasAuthoritativeOfferSlots &&
    ctx.availability.status === "empty" &&
    rules.hasSchedulingPreference &&
    !ctx.availability.inFlightGeneration &&
    goal === "BOOK_APPOINTMENT"
  ) {
    return newDirective({
      ctx,
      code: "NO_AVAILABILITY",
      userRecoverable: true,
      relatedAction: "FIND_AVAILABILITY",
      safeAgentMessage:
        "No availability matched the caller's scheduling preference. Do not invent times. Ask if another day or time would work.",
      at,
    });
  }

  if (goal === "RESCHEDULE_APPOINTMENT" || goal === "CANCEL_APPOINTMENT") {
    if (ctx.appointmentManagement.candidateSet) {
      return newDirective({
        ctx,
        code: "MULTIPLE_APPOINTMENTS_FOUND",
        userRecoverable: true,
        relatedAction: "FIND_EXISTING_APPOINTMENT",
        safeAgentMessage:
          "Multiple existing appointments match. Ask which appointment the caller means using the candidate list in authoritative context.",
        at,
      });
    }
    if (
      ctx.appointmentManagement.lookupCompleted &&
      !ctx.appointmentManagement.verifiedExisting &&
      !ctx.appointmentManagement.candidateSet
    ) {
      return newDirective({
        ctx,
        code: "APPOINTMENT_NOT_FOUND",
        userRecoverable: true,
        relatedAction: "FIND_EXISTING_APPOINTMENT",
        safeAgentMessage:
          "No existing appointment was found for this caller with the information provided. Ask for clarifying details such as date, email, or phone on file.",
        at,
      });
    }
  }

  if (rules.cancellationPhase === "CANCELLATION_CONFIRMATION_REQUIRED") {
    return newDirective({
      ctx,
      code: "CANCELLATION_CONFIRMATION_REQUIRED",
      userRecoverable: true,
      relatedAction: "CANCEL_APPOINTMENT",
      safeAgentMessage:
        "Cancellation requires explicit caller confirmation. Ask naturally whether they want to cancel the identified appointment.",
      at,
    });
  }

  if (
    (goal === "RESCHEDULE_APPOINTMENT" || goal === "CANCEL_APPOINTMENT") &&
    !ctx.intake.values.phone?.value?.trim() &&
    !ctx.intake.values.email?.value?.trim()
  ) {
    return newDirective({
      ctx,
      code: "CALLER_VERIFICATION_REQUIRED",
      userRecoverable: true,
      relatedAction: "FIND_EXISTING_APPOINTMENT",
      safeAgentMessage:
        "To find an existing appointment, capture phone or email on file before lookup.",
      at,
    });
  }

  if (rules.schedulingRequiresClarification && rules.schedulingClarificationPrompt) {
    return newDirective({
      ctx,
      code: "SCHEDULING_AMBIGUOUS",
      userRecoverable: true,
      relatedAction: rules.requiredAction,
      safeAgentMessage: `Scheduling needs clarification: ${rules.schedulingClarificationPrompt} Ask one short natural question. Do not claim availability is confirmed.`,
      at,
    });
  }

  if (
    (goal === "BOOK_APPOINTMENT" || goal === "UNKNOWN") &&
    !rules.hasSchedulingPreference &&
    !rules.schedulingRequiresClarification &&
    (rules.requiredAction === "FIND_AVAILABILITY" || rules.mayFindAvailability)
  ) {
    const meaning = ctx.scheduling.meaning;
    const needsTime =
      meaning?.time_kind === "UNSPECIFIED" && meaning?.date_relation !== "UNSPECIFIED";
    if (needsTime) {
      return newDirective({
        ctx,
        code: "SCHEDULING_TIME_MISSING",
        userRecoverable: true,
        relatedAction: "FIND_AVAILABILITY",
        safeAgentMessage:
          "A date preference exists but time of day is still unclear. Ask what time or part of day works; do not block on unrelated intake fields.",
        at,
      });
    }
    return newDirective({
      ctx,
      code: "SCHEDULING_DATE_MISSING",
      userRecoverable: true,
      relatedAction: "FIND_AVAILABILITY",
      safeAgentMessage:
        "Booking is active but no scheduling date or window is captured yet. Ask what day or timeframe they prefer.",
      at,
    });
  }

  const bookBlockedByIntake =
    rules.slotSelected &&
    !rules.bookingReady &&
    rules.missingRequiredFields.length > 0 &&
    (goal === "BOOK_APPOINTMENT" || goal === "UNKNOWN");

  if (bookBlockedByIntake) {
    const key = prioritizeMissingField(rules.missingRequiredFields, config)!;
    const label = fieldLabel(config, key);
    return newDirective({
      ctx,
      code: "REQUIRED_FIELD_MISSING",
      userRecoverable: true,
      missingFieldKey: key,
      relatedAction: "BOOK_APPOINTMENT",
      safeAgentMessage: `Booking cannot proceed yet because required field "${key}" (${label}) is not captured. Ask naturally for ${label}. Do not repeat fields already captured. Do not claim the appointment is booked.`,
      at,
    });
  }

  if (
    goal === "BOOK_APPOINTMENT" &&
    rules.hasSchedulingPreference &&
    !rules.slotSelected &&
    rules.missingRequiredFields.length > 0 &&
    rules.requiredAction !== "FIND_AVAILABILITY" &&
    ctx.availability.status !== "pending"
  ) {
    const key = prioritizeMissingField(rules.missingRequiredFields, config)!;
    const label = fieldLabel(config, key);
    return newDirective({
      ctx,
      code: "REQUIRED_FIELD_MISSING",
      userRecoverable: true,
      missingFieldKey: key,
      relatedAction: "COLLECT_INTAKE",
      safeAgentMessage: `While scheduling is known, the next missing required field is "${key}" (${label}). You may continue availability work in parallel when the runtime allows; ask naturally for ${label} when appropriate. Do not claim booking is complete.`,
      at,
    });
  }

  if (goal === "UNKNOWN" && !rules.hasSchedulingPreference && rules.missingRequiredFields.length > 0) {
    return newDirective({
      ctx,
      code: "INTENT_AMBIGUOUS",
      userRecoverable: true,
      relatedAction: "CLARIFY_INTENT",
      safeAgentMessage:
        "Caller intent is unclear. Ask one short question about whether they want to book, reschedule, or something else.",
      at,
    });
  }

  return null;
}

export function buildSemanticExtractionRecovery(
  ctx: VoiceV3CallContext,
  at: Date = new Date(),
): VoiceV3RecoveryDirective {
  return newDirective({
    ctx,
    code: "SEMANTIC_EXTRACTION_FAILED",
    userRecoverable: true,
    relatedAction: "CALLER_MEANING",
    safeAgentMessage:
      "The backend could not interpret the caller's last turn after an automatic retry. Ask one short clarifying question about what they want to book or when they would like to come in. Do not pretend you are checking availability unless the runtime has actually started a lookup.",
    at,
  });
}
