import type {
  IntentPolicyShape,
  LeadRecoveryCollectField,
  LeadRecoveryConversationState,
  LeadRecoveryWorkspaceConfig,
  PolicyEvaluationResult,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";
import { pickPrimaryIntentForPolicy } from "@/lib/mctb/lead-recovery/policy-precedence";
import { isActionPermitted } from "@/lib/mctb/lead-recovery/action-registry";

function policyForIntent(
  config: LeadRecoveryWorkspaceConfig,
  intent: StructuredLeadIntent,
): { policy: IntentPolicyShape; policyId: string } {
  const primary = pickPrimaryIntentForPolicy({
    primary: intent.primary_intent,
    secondary: intent.secondary_intents,
  });
  const specific = config.intentPolicies[primary];
  if (specific?.enabled) {
    return { policy: specific, policyId: `intent:${primary}` };
  }
  return { policy: config.fallbackPolicy, policyId: "fallback" };
}

function missingCollectFields(
  policy: IntentPolicyShape,
  collected: Partial<Record<LeadRecoveryCollectField, string>>,
  intent: StructuredLeadIntent,
): LeadRecoveryCollectField[] {
  const effective = { ...collected };
  if (intent.reason_for_contact && policy.collect.includes("REASON") && !effective.REASON) {
    effective.REASON = intent.reason_for_contact;
  }
  return policy.collect.filter((f) => {
    const v = effective[f];
    return !v || !String(v).trim();
  });
}

function applyGlobalMode(
  config: LeadRecoveryWorkspaceConfig,
  policy: IntentPolicyShape,
): IntentPolicyShape {
  if (config.globalMode === "CAPTURE_ONLY") {
    return {
      ...policy,
      actions: policy.actions.filter(
        (a) =>
          a === "COLLECT_FIELD" ||
          a === "SEND_EMAIL_SUMMARY" ||
          a === "SEND_OWNER_SMS" ||
          a === "CUSTOMER_MESSAGE" ||
          a === "CREATE_CALLBACK_REQUEST" ||
          a === "END_AUTOMATION" ||
          a === "SUPPRESS_CONTACT",
      ),
    };
  }
  if (config.globalMode === "INFORMATION_ONLY") {
    return {
      ...policy,
      actions: policy.actions.filter(
        (a) =>
          a !== "AI_BOOK" &&
          a !== "SEND_BOOKING_LINK" &&
          a !== "SEND_TEXT_TO_PAY",
      ),
    };
  }
  return policy;
}

/** Policy test harness — no external mutations. */
export function simulateLeadRecoveryPolicy(input: {
  config: LeadRecoveryWorkspaceConfig;
  intent: StructuredLeadIntent;
  collectedData?: Partial<Record<LeadRecoveryCollectField, string>>;
}): PolicyEvaluationResult {
  const conversationState = {
    conversationId: "test",
    workspaceId: "test",
    currentIntent: input.intent.primary_intent,
    secondaryIntents: input.intent.secondary_intents,
    leadType: input.intent.lead_type,
    urgency: input.intent.urgency,
    serviceCategory: input.intent.service_category,
    collectedFields: input.collectedData || {},
    missingFields: [],
    qualification: null,
    activeSpecialist: null,
    phase: "IDLE" as const,
    clarificationAttempts: 0,
    lastIntent: input.intent,
    updatedAt: new Date().toISOString(),
  };
  return evaluateLeadRecoveryPolicy({
    workspace: input.config,
    intent: input.intent,
    collectedData: input.collectedData || {},
    conversationState,
  });
}

export function evaluateLeadRecoveryPolicy(input: {
  workspace: LeadRecoveryWorkspaceConfig;
  intent: StructuredLeadIntent;
  collectedData: Partial<Record<LeadRecoveryCollectField, string>>;
  conversationState: LeadRecoveryConversationState;
}): PolicyEvaluationResult {
  const { policy: rawPolicy, policyId } = policyForIntent(input.workspace, input.intent);
  const policy = applyGlobalMode(input.workspace, rawPolicy);
  const collected = { ...input.collectedData };

  const missingFields = missingCollectFields(policy, collected, input.intent);
  const permittedActions = policy.actions.filter((a) =>
    isActionPermitted(a, input.workspace),
  );

  const blockedActions = permittedActions
    .filter((a) => a !== "COLLECT_FIELD" && a !== "CUSTOMER_MESSAGE")
    .map((action) => ({
      action,
      blockedBy: missingFields,
    }))
    .filter((b) => b.blockedBy.length > 0);

  const escalation =
    input.intent.human_required ||
    (input.intent.complaint && input.workspace.handoffTriggers.complaint) ||
    (input.intent.urgency === "EMERGENCY" && input.workspace.handoffTriggers.emergency) ||
    (input.intent.confidence < 0.45 && input.workspace.handoffTriggers.uncertain) ||
    policy.escalation?.escalateHuman === true;

  if (escalation && input.workspace.handoffTriggers.complaint && input.intent.complaint) {
    return {
      intent: input.intent.primary_intent,
      matchedPolicyId: policyId,
      phase: "HANDOFF",
      missingFields,
      nextActions: [{ action: "ESCALATE_HUMAN" }, { action: "CUSTOMER_MESSAGE", config: { template: policy.customerMessage } }],
      blockedActions,
      permittedActions,
      responseConstraints: {
        customerMessageTemplate: policy.customerMessage,
        mustNotInventPricing: true,
        mustNotInventAvailability: true,
      },
      escalation: true,
    };
  }

  if (input.intent.confidence < 0.45 && input.conversationState.clarificationAttempts < 1) {
    return {
      intent: input.intent.primary_intent,
      matchedPolicyId: policyId,
      phase: "CLARIFY",
      missingFields,
      nextActions: [
        {
          action: "CUSTOMER_MESSAGE",
          config: {
            template:
              policy.customerMessage ||
              input.workspace.fallbackPolicy.customerMessage ||
              "Sure — what were you calling about?",
          },
        },
      ],
      blockedActions,
      permittedActions,
      responseConstraints: {
        mustNotInventPricing: true,
        mustNotInventAvailability: true,
      },
      escalation: false,
    };
  }

  if (missingFields.length > 0) {
    const field = missingFields[0];
    return {
      intent: input.intent.primary_intent,
      matchedPolicyId: policyId,
      phase: "COLLECT",
      missingFields,
      nextActions: [{ action: "COLLECT_FIELD", field }],
      blockedActions,
      permittedActions,
      responseConstraints: {
        customerMessageTemplate: policy.customerMessage,
        mustNotInventPricing: true,
        mustNotInventAvailability: true,
      },
      escalation: false,
    };
  }

  const execActions = permittedActions
    .filter((a) => a !== "COLLECT_FIELD")
    .map((action) => ({
      action,
      config:
        action === "CUSTOMER_MESSAGE"
          ? { template: policy.customerMessage }
          : policy.providerConfiguration,
    }));

  return {
    intent: input.intent.primary_intent,
    matchedPolicyId: policyId,
    phase: "EXECUTE",
    missingFields: [],
    nextActions: execActions.length ? execActions : [{ action: "NO_OP" }],
    blockedActions: [],
    permittedActions,
    responseConstraints: {
      customerMessageTemplate: policy.customerMessage,
      mustNotInventPricing: input.intent.primary_intent === "PRICING_QUESTION",
      mustNotInventAvailability: true,
    },
    escalation,
  };
}
