import { launchFaqIntentPolicyOverrides } from "@/lib/mctb/lead-recovery/launch-faq-policies";
import type {
  IntentPolicyShape,
  LeadRecoveryConversationState,
  LeadRecoveryIntent,
  LeadRecoveryWorkspaceConfig,
} from "@/lib/mctb/lead-recovery/types";

const INQUIRY_INTENTS = new Set<LeadRecoveryIntent>([
  "GENERAL_INQUIRY",
  "UNKNOWN",
  "BUSINESS_HOURS",
  "BUSINESS_FAQ",
  "BUSINESS_LOCATION",
  "SERVICE_AREA_CHECK",
  "PRICING_QUESTION",
]);

function mergeActions(
  base: IntentPolicyShape["actions"],
  extra: IntentPolicyShape["actions"],
): IntentPolicyShape["actions"] {
  const seen = new Set<string>();
  const out: IntentPolicyShape["actions"] = [];
  for (const a of [...base, ...extra]) {
    if (seen.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out;
}

/**
 * SMS V1: answer from business knowledge and thread context — no default NAME/REASON intake.
 * Explicit enabled collect fields in settings still apply for service/callback flows.
 */
export function normalizeConversationalAiRecoveryConfig(
  config: LeadRecoveryWorkspaceConfig,
): LeadRecoveryWorkspaceConfig {
  const enabledCollect = config.collectCapabilities ?? [];
  const conversationalDefault = enabledCollect.length === 0;
  if (!conversationalDefault) {
    return config;
  }

  const faqOverrides = launchFaqIntentPolicyOverrides();
  const intentPolicies = { ...config.intentPolicies };
  for (const [key, override] of Object.entries(faqOverrides)) {
    const intentKey = key as LeadRecoveryIntent;
    const existing = intentPolicies[intentKey];
    intentPolicies[intentKey] = {
      ...(existing ?? override),
      ...override,
      enabled: existing?.enabled !== false,
      collect: [],
      actions: mergeActions(existing?.actions ?? [], override.actions ?? []),
    };
  }

  for (const intentKey of ["GENERAL_INQUIRY", "UNKNOWN"] as LeadRecoveryIntent[]) {
    const existing = intentPolicies[intentKey];
    if (!existing) continue;
    intentPolicies[intentKey] = {
      ...existing,
      collect: [],
      actions: mergeActions(existing.actions, [
        "ANSWER_APPROVED_INFORMATION",
        "CUSTOMER_MESSAGE",
        "SEND_EMAIL_SUMMARY",
      ]),
    };
  }

  const fallback: IntentPolicyShape = {
    ...config.fallbackPolicy,
    collect: [],
    actions: mergeActions(config.fallbackPolicy.actions, [
      "ANSWER_APPROVED_INFORMATION",
      "CUSTOMER_MESSAGE",
      "SEND_EMAIL_SUMMARY",
    ]),
    customerMessage:
      config.fallbackPolicy.customerMessage ||
      "Thanks for reaching out — how can we help?",
  };

  return {
    ...config,
    intentPolicies,
    fallbackPolicy: fallback,
    collectCapabilities: [],
  };
}

/** Drop stale COLLECT phase when workspace no longer requires rigid field intake. */
export function reconcileStaleLeadRecoveryCollectionState(
  state: LeadRecoveryConversationState,
  config: LeadRecoveryWorkspaceConfig,
): LeadRecoveryConversationState {
  const enabledCollect = config.collectCapabilities ?? [];
  if (enabledCollect.length > 0) {
    return state;
  }

  const stuckInCollect =
    state.phase === "COLLECT" ||
    state.pendingAction?.action === "COLLECT_FIELD" ||
    state.missingFields.length > 0;

  if (!stuckInCollect) {
    return state;
  }

  return {
    ...state,
    phase: state.phase === "COMPLETE" ? "COMPLETE" : "IDLE",
    missingFields: [],
    pendingAction:
      state.pendingAction?.action === "COLLECT_FIELD" ? null : state.pendingAction,
  };
}

export function isInquiryIntent(intent: LeadRecoveryIntent | null | undefined): boolean {
  return intent != null && INQUIRY_INTENTS.has(intent);
}
