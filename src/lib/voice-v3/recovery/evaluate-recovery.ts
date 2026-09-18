import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RuleEvaluation } from "../state/call-rules";
import type { VoiceV3RecoveryCode, VoiceV3RecoveryDirective } from "./types";

const FIND_PENDING_TIMEOUT_MS = 45_000;

function newDirective(input: {
  ctx: VoiceV3CallContext;
  code: VoiceV3RecoveryCode;
  userRecoverable: boolean;
  safeAgentMessage: string;
  missingFieldKey?: string;
  relatedAction?: string;
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
      reason === "auth_failed" || reason === "configuration_missing"
        ? "MICROSOFT_AUTH_FAILED"
        : reason === "timeout"
          ? "PROVIDER_TIMEOUT"
          : "MICROSOFT_TEMPORARY_FAILURE";
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

  const bookBlockedByIntake =
    rules.slotSelected &&
    !rules.bookingReady &&
    rules.missingRequiredFields.length > 0 &&
    (ctx.dialog.activeGoal === "BOOK_APPOINTMENT" || ctx.dialog.activeGoal === "UNKNOWN");

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
    ctx.dialog.activeGoal === "BOOK_APPOINTMENT" &&
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

  if (ctx.booking.lastFailure) {
    return newDirective({
      ctx,
      code: "BOOKING_OUTCOME_UNKNOWN",
      userRecoverable: false,
      relatedAction: "BOOK_APPOINTMENT",
      safeAgentMessage:
        "The booking attempt did not complete successfully. Do not tell the caller they are booked. Explain you need a moment to confirm or try again.",
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
      "The backend could not interpret the caller's last turn. Ask one short clarifying question about what they want to book or when they would like to come in. Do not pretend you are checking availability unless the runtime has actually started a lookup.",
    at,
  });
}
