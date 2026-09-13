import { runLeadRecoveryIntentAgent } from "@/lib/mctb/lead-recovery/intent-agent";
import { evaluateLeadRecoveryPolicyMulti } from "@/lib/mctb/lead-recovery/intent-plan";
import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";
import { computeLeadRecoveryPolicyHealth } from "@/lib/mctb/lead-recovery/policy-health";

export async function simulateLeadRecoveryTurn(input: {
  workspaceId: string;
  config: LeadRecoveryWorkspaceConfig;
  message: string;
  collectedData?: Record<string, string>;
}) {
  const intent = await runLeadRecoveryIntentAgent({ message: input.message });
  const conversationState = {
    conversationId: "simulate",
    workspaceId: input.workspaceId,
    currentIntent: intent.primary_intent,
    secondaryIntents: intent.secondary_intents,
    leadType: intent.lead_type,
    urgency: intent.urgency,
    serviceCategory: intent.service_category,
    collectedFields: input.collectedData || {},
    missingFields: [],
    qualification: null,
    activeSpecialist: null,
    phase: "IDLE" as const,
    clarificationAttempts: 0,
    lastIntent: intent,
    intentPlan: {
      pendingIntents: [],
      completedIntents: [],
      blockedIntents: [],
      currentIntent: null,
    },
    updatedAt: new Date().toISOString(),
  };

  const multi = evaluateLeadRecoveryPolicyMulti({
    workspace: input.config,
    intent,
    collectedData: input.collectedData || {},
    conversationState,
  });

  const health = await computeLeadRecoveryPolicyHealth(input.workspaceId, input.config);

  const draftResponse =
    multi.primary.responseConstraints.customerMessageTemplate ||
    multi.primary.nextActions.find((a) => a.action === "CUSTOMER_MESSAGE")?.config?.template ||
    "Thanks for reaching out — we'll be in touch shortly.";

  return {
    intent,
    primaryPolicy: multi.primary,
    secondaryPolicies: multi.secondaryPlans,
    executionPlan: multi.executionPlan,
    health,
    draftCustomerResponse: String(draftResponse),
    providerDependencies: {
      booking: health.providers.booking,
      payments: health.providers.payments,
    },
  };
}
