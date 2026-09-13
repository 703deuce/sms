import type { LeadRecoveryIntent } from "@/lib/mctb/lead-recovery/types";

/** Canonical policy precedence — lower number wins first. */
export const POLICY_PRECEDENCE: Record<string, number> = {
  OPT_OUT: 1,
  WRONG_NUMBER: 2,
  SENSITIVE_OR_HIGH_RISK: 3,
  COMPLAINT: 4,
  EMERGENCY_OR_URGENT: 5,
  ACTIVE_TRANSACTIONAL: 6,
  EXISTING_CUSTOMER_ISSUE: 7,
  CUSTOM_RULE: 8,
  INTENT_DEFAULT: 9,
  UNKNOWN_FALLBACK: 10,
};

export function precedenceForIntent(intent: LeadRecoveryIntent): number {
  if (intent === "OPT_OUT") return POLICY_PRECEDENCE.OPT_OUT;
  if (intent === "WRONG_NUMBER") return POLICY_PRECEDENCE.WRONG_NUMBER;
  if (intent === "SENSITIVE_OR_HIGH_RISK") return POLICY_PRECEDENCE.SENSITIVE_OR_HIGH_RISK;
  if (intent === "COMPLAINT") return POLICY_PRECEDENCE.COMPLAINT;
  if (intent === "EMERGENCY_OR_URGENT") return POLICY_PRECEDENCE.EMERGENCY_OR_URGENT;
  if (intent === "EXISTING_CUSTOMER_ISSUE") return POLICY_PRECEDENCE.EXISTING_CUSTOMER_ISSUE;
  if (intent === "UNKNOWN") return POLICY_PRECEDENCE.UNKNOWN_FALLBACK;
  return POLICY_PRECEDENCE.INTENT_DEFAULT;
}

export function pickPrimaryIntentForPolicy(intents: {
  primary: LeadRecoveryIntent;
  secondary: LeadRecoveryIntent[];
}): LeadRecoveryIntent {
  const all = [intents.primary, ...intents.secondary];
  let best = intents.primary;
  let bestRank = precedenceForIntent(best);
  for (const i of all) {
    const rank = precedenceForIntent(i);
    if (rank < bestRank) {
      best = i;
      bestRank = rank;
    }
  }
  return best;
}
