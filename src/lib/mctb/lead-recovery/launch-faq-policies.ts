import type { IntentPolicyShape, LeadRecoveryIntent } from "@/lib/mctb/lead-recovery/types";

const FAQ_ANSWER_ACTIONS = ["ANSWER_APPROVED_INFORMATION"] as const;

/** Launch AI Replies: FAQ intents use approved business information — not booking or AI_BOOK. */
export function launchFaqIntentPolicyOverrides(): Partial<
  Record<LeadRecoveryIntent, IntentPolicyShape>
> {
  return {
    BUSINESS_HOURS: {
      enabled: true,
      collect: [],
      actions: [...FAQ_ANSWER_ACTIONS],
    },
    BUSINESS_FAQ: {
      enabled: true,
      collect: [],
      actions: [...FAQ_ANSWER_ACTIONS],
    },
    SERVICE_AREA_CHECK: {
      enabled: true,
      collect: [],
      actions: [...FAQ_ANSWER_ACTIONS],
    },
    BUSINESS_LOCATION: {
      enabled: true,
      collect: [],
      actions: [...FAQ_ANSWER_ACTIONS],
    },
    GENERAL_INQUIRY: {
      enabled: true,
      collect: [],
      actions: [...FAQ_ANSWER_ACTIONS],
    },
    PRICING_QUESTION: {
      enabled: true,
      collect: [],
      actions: [...FAQ_ANSWER_ACTIONS],
    },
  };
}
