import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RuleEvaluation } from "../state/call-rules";
import { evaluateVoiceV3Recovery } from "../recovery/evaluate-recovery";
import type { VoiceV3RecoveryCode } from "../recovery/types";
import type { AgentBlocker } from "./conversation-action";

function recoveryCategoryForCode(code: VoiceV3RecoveryCode): AgentBlocker["recoveryCategory"] {
  switch (code) {
    case "REQUIRED_FIELD_MISSING":
    case "SCHEDULING_DATE_MISSING":
    case "SCHEDULING_TIME_MISSING":
      return "MISSING_INFORMATION";
    case "SCHEDULING_AMBIGUOUS":
    case "INTENT_AMBIGUOUS":
    case "SLOT_SELECTION_AMBIGUOUS":
    case "SLOT_SELECTION_REQUIRED":
      return "CLARIFICATION";
    case "SEMANTIC_EXTRACTION_FAILED":
    case "OPENAI_DELEGATION_FAILURE":
      return "INTERNAL_FAILURE";
    case "MICROSOFT_TEMPORARY_FAILURE":
    case "MICROSOFT_AUTH_FAILED":
    case "PROVIDER_TIMEOUT":
    case "ASYNC_ACTION_TIMED_OUT":
    case "BOOKING_OUTCOME_UNKNOWN":
    case "RESCHEDULE_OUTCOME_UNKNOWN":
    case "CANCELLATION_OUTCOME_UNKNOWN":
    case "MICROSOFT_THROTTLED":
      return "EXTERNAL_FAILURE";
    case "SLOT_NOT_AVAILABLE":
    case "NO_AVAILABILITY":
      return "CONFLICT";
    case "CALLER_VERIFICATION_REQUIRED":
    case "APPOINTMENT_NOT_IDENTIFIED":
    case "MULTIPLE_APPOINTMENTS_FOUND":
      return "VERIFICATION";
    case "CANCELLATION_CONFIRMATION_REQUIRED":
      return "DESTRUCTIVE_CONFIRMATION";
    default:
      return "CLARIFICATION";
  }
}

export interface RecoveryEvaluation {
  directive: ReturnType<typeof evaluateVoiceV3Recovery>;
  blocker: AgentBlocker | null;
}

function isAvailabilityRecoveryCode(code: VoiceV3RecoveryCode): boolean {
  return (
    code === "NO_AVAILABILITY" ||
    code === "SLOT_NOT_AVAILABLE" ||
    code === "MICROSOFT_TEMPORARY_FAILURE"
  );
}

function activeRecoveryStillValid(
  ctx: VoiceV3CallContext,
  active: NonNullable<VoiceV3CallContext["recovery"]["active"]>,
): boolean {
  if (active.code === "INTENT_AMBIGUOUS" && ctx.dialog.activeGoal !== "UNKNOWN") {
    return false;
  }
  if (
    active.code === "REQUIRED_FIELD_MISSING" &&
    active.missingFieldKey &&
    ctx.intake.values[active.missingFieldKey]?.value
  ) {
    return false;
  }
  if (
    active.schedulingGeneration != null &&
    active.schedulingGeneration !== ctx.scheduling.generation &&
    isAvailabilityRecoveryCode(active.code)
  ) {
    return false;
  }
  if (
    isAvailabilityRecoveryCode(active.code) &&
    ctx.availability.status === "ready" &&
    (ctx.availability.activeOfferSet?.slots.length ?? 0) > 0
  ) {
    return false;
  }
  return true;
}

export function evaluateRecoveryBlocker(input: {
  ctx: VoiceV3CallContext;
  rules: VoiceV3RuleEvaluation;
  config: VoiceV3AgentConfig;
  now?: Date;
}): RecoveryEvaluation {
  const fresh = evaluateVoiceV3Recovery(input);
  const active = input.ctx.recovery.active;
  const directive =
    active && active.status === "ACTIVE" && activeRecoveryStillValid(input.ctx, active)
      ? active
      : fresh;
  if (!directive) {
    return { directive: null, blocker: null };
  }
  return {
    directive,
    blocker: {
      code: directive.code,
      recoveryCategory: recoveryCategoryForCode(directive.code),
      userRecoverable: directive.userRecoverable,
    },
  };
}
