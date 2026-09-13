import { isActionPermitted, isKnownAction } from "@/lib/mctb/lead-recovery/action-registry";
import type {
  LeadRecoveryActionId,
  LeadRecoveryIntent,
  LeadRecoveryWorkspaceConfig,
} from "@/lib/mctb/lead-recovery/types";
import type { JohnRuntimeTurnInput, JohnRuntimeTurnResult } from "@/lib/agents/missed-call-text-back/intelligence/types";

const PRICE_IN_REPLY = /\$\s?\d+([\d,.]*\d+)?/;

function policyAllowsAction(
  config: LeadRecoveryWorkspaceConfig,
  intent: LeadRecoveryIntent,
  action: LeadRecoveryActionId,
): boolean {
  if (!isActionPermitted(action, config)) return false;
  const pol = config.intentPolicies[intent];
  const actions = pol?.enabled ? pol.actions : config.fallbackPolicy.actions;
  return actions.includes(action);
}

export function inferIntentFromJohnTurn(turn: JohnRuntimeTurnInput): LeadRecoveryIntent {
  const blob = `${turn.interpreted_intent || ""} ${turn.utterance}`.toLowerCase();
  const ext = turn.extracted_information || {};
  if (ext.intent && typeof ext.intent === "string") {
    const k = ext.intent.toUpperCase().replace(/\s+/g, "_");
    if (isKnownAction(k)) {
      /* not an action */
    }
  }
  if (/emergency|urgent|flood|water pouring|gas leak/.test(blob)) return "EMERGENCY_OR_URGENT";
  if (/pay|deposit|invoice|balance due/.test(blob)) return "PAYMENT_REQUEST";
  if (/book|schedule|appointment|tomorrow/.test(blob)) return "BOOKING_REQUEST";
  if (/\$\d|price|cost|how much/.test(blob)) return "PRICING_QUESTION";
  return "UNKNOWN";
}

export function extractJohnProposedActions(turn: JohnRuntimeTurnInput): LeadRecoveryActionId[] {
  const proposed = new Set<LeadRecoveryActionId>();
  const ext = turn.extracted_information || {};
  const rawAction = ext.proposed_action || ext.proposedAction || ext.action;
  if (typeof rawAction === "string" && isKnownAction(rawAction)) {
    proposed.add(rawAction);
  }
  const intent = `${turn.interpreted_intent || ""}`.toLowerCase();
  if (/book|schedule|appointment/.test(intent)) proposed.add("AI_BOOK");
  if (/payment|pay|text.to.pay|invoice/.test(intent)) proposed.add("SEND_TEXT_TO_PAY");
  if (/emergency|on.call|urgent/.test(intent)) proposed.add("ROUTE_TO_ON_CALL");
  return [...proposed];
}

export type JohnPolicyGuardResult =
  | { ok: true }
  | { ok: false; code: "BLOCKED_BY_POLICY"; action: LeadRecoveryActionId };

export function validateJohnProposedActions(input: {
  config: LeadRecoveryWorkspaceConfig;
  turn: JohnRuntimeTurnInput;
}): JohnPolicyGuardResult {
  if (!input.config.enabled) return { ok: true };
  const intent = inferIntentFromJohnTurn(input.turn);
  const actions = extractJohnProposedActions(input.turn);
  for (const action of actions) {
    if (action === "SEND_TEXT_TO_PAY") {
      if (!input.config.paymentPolicy.textToPayEnabled) {
        return { ok: false, code: "BLOCKED_BY_POLICY", action };
      }
    }
    if (!policyAllowsAction(input.config, intent, action)) {
      return { ok: false, code: "BLOCKED_BY_POLICY", action };
    }
  }
  return { ok: true };
}

export function enforceJohnRuntimeTurnWithLeadRecovery(input: {
  config: LeadRecoveryWorkspaceConfig;
  turn: JohnRuntimeTurnInput;
  runtimeResult: JohnRuntimeTurnResult;
}): JohnRuntimeTurnResult {
  const guard = validateJohnProposedActions({ config: input.config, turn: input.turn });
  if (guard.ok) return input.runtimeResult;
  return {
    ...input.runtimeResult,
    action: "RESPOND_TO_CUSTOMER",
    response_context: {
      ...input.runtimeResult.response_context,
      lead_recovery_blocked: guard.code,
      blocked_action: guard.action,
    },
  };
}

export function sanitizeJohnReplyForLeadRecovery(
  reply: string,
  config: LeadRecoveryWorkspaceConfig,
): string {
  if (!config.enabled) return reply;
  const pricingMode = config.intentPolicies.PRICING_QUESTION?.mode || "ESTIMATE_REQUIRED";
  if (pricingMode === "ESTIMATE_REQUIRED" && PRICE_IN_REPLY.test(reply)) {
    return "I can't quote an exact price by text — our team will provide an estimate. What's the best address for the service?";
  }
  if (!config.paymentPolicy.textToPayEnabled && /\b(i sent|here is your payment|pay \$)/i.test(reply)) {
    return "I can't send a payment link unless our team sets that up. Someone will follow up with you shortly.";
  }
  if (
    !policyAllowsAction(config, "BOOKING_REQUEST", "AI_BOOK") &&
    /\b(i booked|you're scheduled|appointment is confirmed)\b/i.test(reply)
  ) {
    return "I can't confirm a booking from here — our team will help schedule your visit.";
  }
  return reply;
}

export function buildLeadRecoveryJohnPromptConstraints(config: LeadRecoveryWorkspaceConfig): string {
  if (!config.enabled) return "";
  return `
# AI LEAD RECOVERY (authoritative — overrides conversational guesses)
Lead Recovery policy is enabled for this workspace. You are fallback only when Lead Recovery did not handle the message.
You MUST NOT:
- override matched Lead Recovery policy or invent actions outside the action registry
- initiate AI Booking if booking policy forbids it
- send payment or quote dollar amounts if payment/pricing policy forbids it
- invent availability or claim a booking succeeded without provider confirmation
- reroute emergencies contrary to emergency policy
- bypass opt-out or compliance rules
All consequential actions must go through Policy Engine → Action Registry → Runtime. Never call providers directly.
`;
}
