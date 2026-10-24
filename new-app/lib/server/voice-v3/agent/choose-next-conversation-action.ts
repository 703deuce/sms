import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RuleEvaluation } from "../state/call-rules";
import type { ConversationAction } from "./conversation-action";
import type { RecoveryEvaluation } from "./evaluate-recovery-blocker";
import type { RequirementsEvaluation } from "./evaluate-requirements";
import type { OperationsEvaluation } from "./evaluate-operations";
import type { GoalsEvaluation } from "./evaluate-goals";
import { shouldOfferHandoff } from "./escalation";

function prioritizeMissingField(missing: string[], config: VoiceV3AgentConfig): string | null {
  if (missing.length === 0) return null;
  for (const field of config.intakeFields) {
    if (missing.includes(field.key)) return field.key;
  }
  return missing[0] ?? null;
}

export function chooseNextConversationAction(input: {
  ctx: VoiceV3CallContext;
  rules: VoiceV3RuleEvaluation;
  config: VoiceV3AgentConfig;
  goals: GoalsEvaluation;
  requirements: RequirementsEvaluation;
  operations: OperationsEvaluation;
  recovery: RecoveryEvaluation;
}): ConversationAction {
  const { ctx, rules, config, recovery, operations } = input;

  const handoff = shouldOfferHandoff(ctx);
  if (handoff.required && handoff.fallback) {
    return { type: "OFFER_HANDOFF", reason: handoff.reason };
  }

  if (ctx.dialog.activeGoal === "REQUEST_TRANSFER" && input.goals.active === "REQUEST_TRANSFER") {
    return { type: "OFFER_HANDOFF", reason: "caller_requested_human" };
  }

  const findRunning = operations.active.some(
    (o) => o.type === "FIND_AVAILABILITY" && o.status === "RUNNING",
  );
  if (findRunning) {
    const op = operations.active.find((o) => o.type === "FIND_AVAILABILITY");
    return op
      ? { type: "ACKNOWLEDGE_PENDING_ACTION", operationId: op.operationId }
      : { type: "NONE" };
  }

  if (recovery.blocker && recovery.directive) {
    const code = recovery.directive.code;
    switch (code) {
      case "MICROSOFT_TEMPORARY_FAILURE":
      case "MICROSOFT_AUTH_FAILED":
      case "PROVIDER_TIMEOUT":
      case "ASYNC_ACTION_TIMED_OUT":
      case "BOOKING_OUTCOME_UNKNOWN":
      case "RESCHEDULE_OUTCOME_UNKNOWN":
      case "CANCELLATION_OUTCOME_UNKNOWN":
      case "MICROSOFT_THROTTLED":
        return { type: "INFORM_TEMPORARY_FAILURE", failureCode: code };
      case "SCHEDULING_AMBIGUOUS":
        return {
          type: "CLARIFY_SCHEDULING",
          reason: rules.schedulingClarificationReason ?? "ambiguous",
        };
      case "SLOT_SELECTION_AMBIGUOUS":
      case "SLOT_SELECTION_REQUIRED":
        return { type: "CLARIFY_SLOT_SELECTION" };
      case "CANCELLATION_CONFIRMATION_REQUIRED":
        return {
          type: "CONFIRM_CANCELLATION",
          attemptId: ctx.appointmentManagement.cancellation.cancellationAttemptId ?? undefined,
        };
      case "MULTIPLE_APPOINTMENTS_FOUND":
      case "APPOINTMENT_NOT_IDENTIFIED":
        return { type: "VERIFY_CALLER" };
      case "CALLER_VERIFICATION_REQUIRED":
        return { type: "VERIFY_CALLER" };
      case "REQUIRED_FIELD_MISSING":
        return {
          type: "ASK_REQUIRED_FIELD",
          fieldKey: recovery.directive.missingFieldKey ?? prioritizeMissingField(rules.missingRequiredFields, config)!,
        };
      case "SCHEDULING_DATE_MISSING":
        return { type: "ASK_SCHEDULING_DATE" };
      case "SCHEDULING_TIME_MISSING":
        return { type: "ASK_SCHEDULING_TIME" };
      case "SEMANTIC_EXTRACTION_FAILED":
      case "OPENAI_DELEGATION_FAILURE":
        return { type: "CLARIFY_INTENT" };
      case "INTENT_AMBIGUOUS":
        return { type: "CLARIFY_INTENT" };
      default:
        if (recovery.blocker?.userRecoverable) {
          return { type: "INFORM_TEMPORARY_FAILURE", failureCode: code };
        }
        return { type: "NONE" };
    }
  }

  if (ctx.booking.phase === "BOOKING_CONFIRMED" && !ctx.conversation?.closingOffered) {
    return { type: "ASK_ANYTHING_ELSE" };
  }

  if (
    rules.requiredAction === "FIND_AVAILABILITY" ||
    (ctx.availability.status === "ready" && ctx.availability.activeOfferSet)
  ) {
    if (ctx.availability.status === "ready" && ctx.availability.activeOfferSet?.slots.length) {
      return {
        type: "PRESENT_AVAILABILITY",
        offerSetId: ctx.availability.activeOfferSet.offerSetId,
      };
    }
    if (ctx.availability.status === "empty") {
      return { type: "INFORM_TEMPORARY_FAILURE", failureCode: "NO_AVAILABILITY" };
    }
  }

  const missing = prioritizeMissingField(rules.missingRequiredFields, config);
  if (missing && !rules.slotSelected && ctx.dialog.activeGoal === "BOOK_APPOINTMENT") {
    return { type: "ASK_REQUIRED_FIELD", fieldKey: missing };
  }

  if (
    ctx.dialog.activeGoal === "BOOK_APPOINTMENT" &&
    !rules.hasSchedulingPreference &&
    !rules.schedulingRequiresClarification
  ) {
    return { type: "ASK_SCHEDULING_DATE" };
  }

  if (missing && !rules.slotSelected) {
    return { type: "ASK_REQUIRED_FIELD", fieldKey: missing };
  }

  return { type: "NONE" };
}
