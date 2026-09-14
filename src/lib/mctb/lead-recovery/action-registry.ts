import type {
  LeadRecoveryActionId,
  LeadRecoveryWorkspaceConfig,
} from "@/lib/mctb/lead-recovery/types";

export type ActionRegistryEntry = {
  id: LeadRecoveryActionId;
  requiredFields: string[];
  requiresEntitlement?: string;
  providerDependency?: "calendar" | "stripe" | null;
  description: string;
};

export const ACTION_REGISTRY: Record<LeadRecoveryActionId, ActionRegistryEntry> = {
  COLLECT_FIELD: {
    id: "COLLECT_FIELD",
    requiredFields: [],
    description: "Ask customer for a configured field",
  },
  SEND_BOOKING_LINK: {
    id: "SEND_BOOKING_LINK",
    requiredFields: [],
    description: "Send configured booking URL",
  },
  AI_BOOK: {
    id: "AI_BOOK",
    requiredFields: [],
    providerDependency: "calendar",
    requiresEntitlement: "ai_booking",
    description:
      "AI scheduling workflow (provider availability READ; CREATE_BOOKING only after orchestrator confirmation)",
  },
  CREATE_CALLBACK_REQUEST: {
    id: "CREATE_CALLBACK_REQUEST",
    requiredFields: ["REASON"],
    description: "Create canonical callback / handoff task",
  },
  SEND_OWNER_SMS: {
    id: "SEND_OWNER_SMS",
    requiredFields: [],
    description: "Notify owner via SMS",
  },
  SEND_TEAM_SMS: {
    id: "SEND_TEAM_SMS",
    requiredFields: [],
    description: "Notify team via SMS",
  },
  SEND_EMAIL_SUMMARY: {
    id: "SEND_EMAIL_SUMMARY",
    requiredFields: [],
    description: "Email summary to configured recipients",
  },
  ROUTE_TO_TEAM: {
    id: "ROUTE_TO_TEAM",
    requiredFields: [],
    description: "Route to configured team recipient",
  },
  ROUTE_TO_ON_CALL: {
    id: "ROUTE_TO_ON_CALL",
    requiredFields: [],
    description: "Route to on-call recipient",
  },
  SEND_TEXT_TO_PAY: {
    id: "SEND_TEXT_TO_PAY",
    requiredFields: [],
    providerDependency: "stripe",
    requiresEntitlement: "text_to_pay",
    description: "Payment policy → PaymentRequest → Stripe adapter; authoritative amount required",
  },
  CHECK_PAYMENT_STATUS: {
    id: "CHECK_PAYMENT_STATUS",
    requiredFields: [],
    providerDependency: "stripe",
    description: "Lookup authoritative payment status",
  },
  ANSWER_APPROVED_INFORMATION: {
    id: "ANSWER_APPROVED_INFORMATION",
    requiredFields: [],
    description: "Answer from configured knowledge only",
  },
  ESCALATE_HUMAN: {
    id: "ESCALATE_HUMAN",
    requiredFields: [],
    description: "Human handoff with structured context",
  },
  END_AUTOMATION: {
    id: "END_AUTOMATION",
    requiredFields: [],
    description: "Stop automated recovery for thread",
  },
  SUPPRESS_CONTACT: {
    id: "SUPPRESS_CONTACT",
    requiredFields: [],
    description: "Compliance opt-out handling",
  },
  FOLLOW_UP: {
    id: "FOLLOW_UP",
    requiredFields: [],
    description: "Schedule configured follow-up",
  },
  CUSTOMER_MESSAGE: {
    id: "CUSTOMER_MESSAGE",
    requiredFields: [],
    description: "Send configured or generated customer SMS",
  },
  NO_OP: {
    id: "NO_OP",
    requiredFields: [],
    description: "No external mutation",
  },
};

export function isKnownAction(action: string): action is LeadRecoveryActionId {
  return action in ACTION_REGISTRY;
}

export function isActionPermitted(
  action: LeadRecoveryActionId,
  config: LeadRecoveryWorkspaceConfig,
): boolean {
  if (!isKnownAction(action)) return false;
  if (!config.actionCapabilities.includes(action) && action !== "CUSTOMER_MESSAGE" && action !== "NO_OP" && action !== "COLLECT_FIELD") {
    // Always allow compliance + messaging primitives
    if (action === "SUPPRESS_CONTACT" || action === "END_AUTOMATION" || action === "ESCALATE_HUMAN") {
      return true;
    }
    return false;
  }
  return true;
}
