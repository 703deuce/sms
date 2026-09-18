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

export function evaluateRecoveryBlocker(input: {
  ctx: VoiceV3CallContext;
  rules: VoiceV3RuleEvaluation;
  config: VoiceV3AgentConfig;
  now?: Date;
}): RecoveryEvaluation {
  const active = input.ctx.recovery.active;
  const directive =
    active && active.status === "ACTIVE"
      ? active
      : evaluateVoiceV3Recovery(input);
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
