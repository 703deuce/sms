import { buildEmptyAvailabilityGuidance } from "../calendar/empty-availability-guidance";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RuleEvaluation } from "../state/call-rules";
import { evaluateVoiceV3Recovery } from "./evaluate-recovery";

export type SuggestedNextConversationAction =
  | "NONE"
  | "ASK_FIELD"
  | "ASK_SCHEDULING_DATE"
  | "ASK_SCHEDULING_TIME"
  | "CLARIFY_SCHEDULING"
  | "PRESENT_AVAILABILITY"
  | "CLARIFY_SLOT"
  | "CONFIRM_CANCELLATION"
  | "INFORM_TEMPORARY_FAILURE"
  | "CLARIFY_APPOINTMENT"
  | "VERIFY_CALLER";

export type SuggestedConversationNeed = {
  action: SuggestedNextConversationAction;
  fieldKey?: string;
  recoveryCode?: string;
  summary: string;
};

function prioritizeMissingField(missing: string[], config: VoiceV3AgentConfig): string | null {
  if (missing.length === 0) return null;
  for (const field of config.intakeFields) {
    if (missing.includes(field.key)) return field.key;
  }
  return missing[0] ?? null;
}

/**
 * Dynamic next conversational need from authoritative state — not a scripted question index.
 */
export function evaluateSuggestedNextConversationAction(input: {
  ctx: VoiceV3CallContext;
  rules: VoiceV3RuleEvaluation;
  config: VoiceV3AgentConfig;
}): SuggestedConversationNeed {
  const { ctx, rules, config } = input;
  const recovery = evaluateVoiceV3Recovery({ ctx, rules, config });

  if (ctx.availability.status === "pending") {
    return {
      action: "NONE",
      summary: "FIND availability lookup in progress; continue natural conversation without claiming results.",
    };
  }

  if (recovery) {
    switch (recovery.code) {
      case "MICROSOFT_TEMPORARY_FAILURE":
      case "MICROSOFT_AUTH_FAILED":
      case "PROVIDER_TIMEOUT":
      case "ASYNC_ACTION_TIMED_OUT":
      case "BOOKING_OUTCOME_UNKNOWN":
        return {
          action: "INFORM_TEMPORARY_FAILURE",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "SCHEDULING_AMBIGUOUS":
        return {
          action: "CLARIFY_SCHEDULING",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "SLOT_SELECTION_AMBIGUOUS":
        return {
          action: "CLARIFY_SLOT",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "CANCELLATION_CONFIRMATION_REQUIRED":
        return {
          action: "CONFIRM_CANCELLATION",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "MULTIPLE_APPOINTMENTS_FOUND":
        return {
          action: "CLARIFY_APPOINTMENT",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "CALLER_VERIFICATION_REQUIRED":
        return {
          action: "VERIFY_CALLER",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "REQUIRED_FIELD_MISSING":
        return {
          action: "ASK_FIELD",
          fieldKey: recovery.missingFieldKey,
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "SCHEDULING_DATE_MISSING":
        return {
          action: "ASK_SCHEDULING_DATE",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "SCHEDULING_TIME_MISSING":
        return {
          action: "ASK_SCHEDULING_TIME",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "INTENT_AMBIGUOUS":
        return {
          action: "CLARIFY_APPOINTMENT",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      case "SEMANTIC_EXTRACTION_FAILED":
      case "OPENAI_DELEGATION_FAILURE":
        return {
          action: "INFORM_TEMPORARY_FAILURE",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
      default:
        return {
          action: recovery.userRecoverable ? "INFORM_TEMPORARY_FAILURE" : "NONE",
          recoveryCode: recovery.code,
          summary: recovery.safeAgentMessage,
        };
    }
  }

  if (
    rules.requiredAction === "FIND_AVAILABILITY" ||
    (ctx.availability.status === "ready" && ctx.availability.activeOfferSet)
  ) {
    if (ctx.availability.status === "ready" && ctx.availability.activeOfferSet?.slots.length) {
      return {
        action: "PRESENT_AVAILABILITY",
        summary:
          "Authoritative availability is ready. Offer times naturally from the authoritative offer set; do not invent slots.",
      };
    }
    if (ctx.availability.status === "empty") {
      const guidance = buildEmptyAvailabilityGuidance(config, ctx);
      return {
        action: guidance.reason === "CLOSED_WEEKDAY" ? "CLARIFY_SCHEDULING" : "INFORM_TEMPORARY_FAILURE",
        summary: guidance.safeAgentMessage,
      };
    }
  }

  if (
    ctx.dialog.activeGoal === "BOOK_APPOINTMENT" &&
    !rules.hasSchedulingPreference &&
    !rules.schedulingRequiresClarification
  ) {
    return {
      action: "ASK_SCHEDULING_DATE",
      summary: "Booking intent is active but no scheduling preference is captured yet.",
    };
  }

  const missing = prioritizeMissingField(rules.missingRequiredFields, config);
  if (missing && !rules.slotSelected) {
    const label = config.intakeFields.find((f) => f.key === missing)?.label ?? missing;
    return {
      action: "ASK_FIELD",
      fieldKey: missing,
      summary: `Optional conversational need: collect ${label} while scheduling/availability may proceed in parallel.`,
    };
  }

  return { action: "NONE", summary: "No active recovery need; follow caller-led conversation." };
}
