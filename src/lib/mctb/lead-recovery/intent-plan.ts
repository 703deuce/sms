import type {
  IntentExecutionPlanState,
  LeadRecoveryIntent,
  MultiIntentPolicyResult,
  PolicyEvaluationResult,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";
import { pickPrimaryIntentForPolicy } from "@/lib/mctb/lead-recovery/policy-precedence";
import { evaluateLeadRecoveryPolicyForIntent } from "@/lib/mctb/lead-recovery/policy-engine";
import type {
  LeadRecoveryConversationState,
  LeadRecoveryWorkspaceConfig,
} from "@/lib/mctb/lead-recovery/types";

function uniqueIntents(intents: LeadRecoveryIntent[]): LeadRecoveryIntent[] {
  return [...new Set(intents)];
}

export function buildIntentQueue(intent: StructuredLeadIntent): LeadRecoveryIntent[] {
  const primary = pickPrimaryIntentForPolicy({
    primary: intent.primary_intent,
    secondary: intent.secondary_intents,
  });
  const rest = uniqueIntents([
    intent.primary_intent,
    ...intent.secondary_intents,
  ]).filter((i) => i !== primary);
  return [primary, ...rest];
}

export function evaluateLeadRecoveryPolicyMulti(input: {
  workspace: LeadRecoveryWorkspaceConfig;
  intent: StructuredLeadIntent;
  collectedData: Partial<Record<import("@/lib/mctb/lead-recovery/types").LeadRecoveryCollectField, string>>;
  conversationState: LeadRecoveryConversationState;
}): MultiIntentPolicyResult {
  const existing = input.conversationState.intentPlan;
  const queue =
    existing.pendingIntents.length > 0 || existing.currentIntent
      ? [
          ...(existing.currentIntent ? [existing.currentIntent] : []),
          ...existing.pendingIntents,
        ]
      : buildIntentQueue(input.intent);

  const completed = new Set(existing.completedIntents);
  const pending = queue.filter((i) => !completed.has(i));
  const current = pending[0] || null;
  const rest = pending.slice(1);

  const syntheticIntent = (target: LeadRecoveryIntent): StructuredLeadIntent => ({
    ...input.intent,
    primary_intent: target,
    secondary_intents: input.intent.secondary_intents.filter((s) => s !== target),
  });

  const primaryPlan = current
    ? evaluateLeadRecoveryPolicyForIntent({
        ...input,
        intent: syntheticIntent(current),
        targetIntent: current,
      })
    : evaluateLeadRecoveryPolicyForIntent({
        ...input,
        intent: input.intent,
        targetIntent: input.intent.primary_intent,
      });

  const secondaryPlans = rest.map((intent) => ({
    intent,
    plan: evaluateLeadRecoveryPolicyForIntent({
      ...input,
      intent: syntheticIntent(intent),
      targetIntent: intent,
    }),
  }));

  const executionPlan: IntentExecutionPlanState = {
    pendingIntents: rest,
    completedIntents: [...completed],
    blockedIntents: [],
    currentIntent: current,
  };

  return {
    primary: primaryPlan,
    secondaryPlans,
    executionPlan,
  };
}

export function markIntentCompleted(
  plan: IntentExecutionPlanState,
  intent: LeadRecoveryIntent,
): IntentExecutionPlanState {
  const completed = uniqueIntents([...plan.completedIntents, intent]);
  const pending = plan.pendingIntents.filter((i) => i !== intent);
  return {
    ...plan,
    completedIntents: completed,
    pendingIntents: pending,
    currentIntent: pending[0] || null,
  };
}
