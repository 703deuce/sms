import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";

/** Merge unsaved UI draft over saved config for simulation (no persistence). */
export function mergeLeadRecoveryDraftConfig(
  saved: LeadRecoveryWorkspaceConfig,
  draft: Partial<LeadRecoveryWorkspaceConfig> | Record<string, unknown> | undefined,
): LeadRecoveryWorkspaceConfig {
  if (!draft || typeof draft !== "object") return saved;
  const d = draft as Partial<LeadRecoveryWorkspaceConfig>;
  return {
    ...saved,
    ...d,
    enabled: d.enabled ?? saved.enabled,
    enabledScenarios: { ...saved.enabledScenarios, ...d.enabledScenarios },
    intentPolicies: { ...saved.intentPolicies, ...d.intentPolicies },
    globalBehavior: { ...saved.globalBehavior, ...d.globalBehavior },
    paymentPolicy: { ...saved.paymentPolicy, ...d.paymentPolicy },
    serviceAreaPolicy: { ...saved.serviceAreaPolicy, ...d.serviceAreaPolicy },
    existingCustomerPolicy: {
      ...saved.existingCustomerPolicy,
      ...d.existingCustomerPolicy,
    },
    faqPolicy: { ...saved.faqPolicy, ...d.faqPolicy },
    handoffTriggers: { ...saved.handoffTriggers, ...d.handoffTriggers },
    answerCapabilities: d.answerCapabilities ?? saved.answerCapabilities,
    actionCapabilities: d.actionCapabilities ?? saved.actionCapabilities,
    collectCapabilities: d.collectCapabilities ?? saved.collectCapabilities,
  };
}
