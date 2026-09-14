import { bumpStateVersion, invalidatePendingActions } from "@/lib/mctb/lead-recovery/conversation-guard";
import type {
  LeadRecoveryActionId,
  LeadRecoveryConversationState,
  LeadRecoveryWorkflowUpdate,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";

const PAYMENT_ACTIONS = new Set<LeadRecoveryActionId>(["SEND_TEXT_TO_PAY"]);
const BOOKING_ACTIONS = new Set<LeadRecoveryActionId>(["AI_BOOK", "SEND_BOOKING_LINK"]);
const CALLBACK_ACTIONS = new Set<LeadRecoveryActionId>(["CREATE_CALLBACK_REQUEST"]);

function targetsAction(
  target: LeadRecoveryWorkflowUpdate["target"],
  action: LeadRecoveryActionId,
): boolean {
  if (target === "ALL_PENDING") return true;
  if (target === "PENDING_PAYMENT") return PAYMENT_ACTIONS.has(action);
  if (target === "PENDING_BOOKING") return BOOKING_ACTIONS.has(action);
  if (target === "PENDING_CALLBACK") return CALLBACK_ACTIONS.has(action);
  return false;
}

function invalidateIfMatches(
  state: LeadRecoveryConversationState,
  target: LeadRecoveryWorkflowUpdate["target"],
): LeadRecoveryConversationState {
  const pending = state.pendingAction?.action;
  if (!pending) return state;
  if (!targetsAction(target, pending)) return state;
  return invalidatePendingActions(state);
}

/**
 * Runtime invalidation driven by structured semantic output — not message regex.
 */
export function applyWorkflowInvalidation(
  state: LeadRecoveryConversationState,
  intent: StructuredLeadIntent,
): LeadRecoveryConversationState {
  const scope = intent.stop_scope;
  if (
    scope === "BOOKING" ||
    scope === "CURRENT_WORKFLOW" ||
    scope === "PAYMENT" ||
    scope === "CALLBACK"
  ) {
    if (intent.primary_intent !== "OPT_OUT") {
      if (scope === "PAYMENT") return invalidateIfMatches(state, "PENDING_PAYMENT");
      if (scope === "CALLBACK") return invalidateIfMatches(state, "PENDING_CALLBACK");
      return invalidateIfMatches(state, "PENDING_BOOKING");
    }
  }

  if (intent.primary_intent === "OPT_OUT" && scope !== "BOOKING" && scope !== "CURRENT_WORKFLOW") {
    return invalidatePendingActions(state);
  }

  const updates = intent.workflow_updates ?? [];
  if (updates.length === 0) {
    if (intent.primary_intent === "WRONG_NUMBER") {
      return invalidatePendingActions(state);
    }
    return state;
  }

  let next = state;
  for (const update of updates) {
    if (update.instruction === "KEEP") continue;
    if (update.instruction === "CANCEL") {
      next = invalidateIfMatches(next, update.target);
    }
  }
  return next;
}

/** @deprecated use applyWorkflowInvalidation — test helper */
export function shouldInvalidatePendingActions(input: {
  intent: StructuredLeadIntent;
  body: string;
}): boolean {
  if (input.intent.primary_intent === "OPT_OUT" || input.intent.primary_intent === "WRONG_NUMBER") {
    return true;
  }
  return (input.intent.workflow_updates ?? []).some((u) => u.instruction === "CANCEL");
}
