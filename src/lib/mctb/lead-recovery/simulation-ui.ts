import type { LeadRecoveryActionId, LeadRecoveryIntent, PolicyEvaluationResult } from "@/lib/mctb/lead-recovery/types";
import type { simulateLeadRecoveryTurn } from "@/lib/mctb/lead-recovery/simulation";

const INTENT_LABELS: Partial<Record<LeadRecoveryIntent, string>> = {
  EMERGENCY_OR_URGENT: "Emergency",
  BOOKING_REQUEST: "Booking",
  PRICING_QUESTION: "Pricing question",
  PAYMENT_REQUEST: "Payment",
  SERVICE_AREA_CHECK: "Service area",
  EXISTING_CUSTOMER_ISSUE: "Existing customer",
  GENERAL_INQUIRY: "Take a message",
  BUSINESS_FAQ: "FAQ",
  BUSINESS_HOURS: "Business hours",
};

const ACTION_LABELS: Partial<Record<LeadRecoveryActionId, string>> = {
  SEND_OWNER_SMS: "Text on-call recipient",
  ROUTE_TO_ON_CALL: "Route to on-call",
  CREATE_CALLBACK_REQUEST: "Create callback request",
  COLLECT_FIELD: "Collect information",
  AI_BOOK: "AI Booking",
  SEND_BOOKING_LINK: "Send booking link",
  SEND_TEXT_TO_PAY: "Send Text-to-Pay",
  SEND_EMAIL_SUMMARY: "Notify business",
  ESCALATE_HUMAN: "Human handoff",
  CUSTOMER_MESSAGE: "Customer message",
  ANSWER_APPROVED_INFORMATION: "Answer from approved knowledge",
};

function intentLabel(intent: LeadRecoveryIntent): string {
  return INTENT_LABELS[intent] || intent.replace(/_/g, " ").toLowerCase();
}

function actionLabel(action: LeadRecoveryActionId, field?: string): string {
  if (action === "COLLECT_FIELD" && field) {
    return `Collect ${field.replace(/_/g, " ").toLowerCase()}`;
  }
  return ACTION_LABELS[action] || action.replace(/_/g, " ").toLowerCase();
}

function confidenceLabel(n: number): string {
  if (n >= 0.75) return "High";
  if (n >= 0.45) return "Medium";
  return "Low";
}

function policyStatusFromPlan(plan: PolicyEvaluationResult): string {
  if (plan.phase === "HANDOFF") return "Handoff";
  if (plan.blockedActions.length) return "Blocked";
  if (plan.phase === "COLLECT") return "Ready";
  return "Ready";
}

function buildActionPlanSteps(plan: PolicyEvaluationResult): string[] {
  const steps: string[] = [];
  for (const na of plan.nextActions) {
    if (na.action === "CUSTOMER_MESSAGE" && plan.nextActions.length > 1) continue;
    steps.push(actionLabel(na.action, na.field));
  }
  return steps.length ? steps : ["Continue conversation"];
}

function buildBlockedLines(
  plan: PolicyEvaluationResult,
  providerBooking: string,
): Array<{ label: string; reason: string }> {
  const blocked: Array<{ label: string; reason: string }> = [];
  for (const b of plan.blockedActions) {
    blocked.push({
      label: actionLabel(b.action),
      reason: `Missing: ${b.blockedBy.join(", ")}`,
    });
  }
  if (plan.nextActions.some((a) => a.action === "AI_BOOK") && providerBooking !== "READY") {
    blocked.push({
      label: "AI Booking",
      reason:
        providerBooking === "PROVIDER_BLOCKED" || providerBooking === "NEEDS_CONFIGURATION"
          ? "Calendar provider needs attention"
          : "Provider not ready",
    });
  }
  return blocked;
}

export type StructuredSimulationUi = {
  detected: {
    primaryIntent: string;
    secondaryIntents: string[];
    urgency: string;
    confidence: string;
  };
  policy: {
    matchedPolicy: string;
    status: string;
  };
  collect: string[];
  actionPlan: string[];
  executionSequence: string[];
  immediateActions: string[];
  blocked: Array<{ label: string; reason: string }>;
  customerResponse: string;
  domainEvents: string[];
  paymentNote?: string;
};

export function formatStructuredSimulation(
  raw: Awaited<ReturnType<typeof simulateLeadRecoveryTurn>>,
): StructuredSimulationUi {
  const intent = raw.intent;
  const primary = raw.primaryPolicy;
  const bookingHealth = raw.providerDependencies.booking;

  const secondaryLabels = [
    ...new Set(
      [intent.primary_intent, ...intent.secondary_intents]
        .filter((i) => i !== primary.intent)
        .map((i) => intentLabel(i)),
    ),
  ];

  const collect = primary.missingFields.map((f) => f.replace(/_/g, " "));

  const immediate = primary.nextActions
    .filter((a) =>
      ["SEND_OWNER_SMS", "ROUTE_TO_ON_CALL", "SEND_TEAM_SMS", "CREATE_CALLBACK_REQUEST"].includes(
        a.action,
      ),
    )
    .map((a) => actionLabel(a.action, a.field));

  const actionPlan = buildActionPlanSteps(primary);

  const executionSequence = raw.executionPlan.pendingIntents.length
    ? [
        `1. Apply ${intentLabel(primary.intent)} policy`,
        ...raw.secondaryPolicies.map(
          (s, i) => `${i + 2}. Apply ${intentLabel(s.intent)} policy`,
        ),
      ]
    : actionPlan.map((s, i) => `${i + 1}. ${s}`);

  const events: string[] = [];
  if (intent.urgency === "EMERGENCY") events.push("Emergency identified");
  if (immediate.some((s) => s.toLowerCase().includes("on-call"))) events.push("On-call notified");
  if (collect.includes("address")) events.push("Address collected");
  if (primary.nextActions.some((a) => a.action === "CREATE_CALLBACK_REQUEST")) {
    events.push("Callback requested");
  }

  let paymentNote: string | undefined;
  if (primary.intent === "PAYMENT_REQUEST") {
    const hasPay = primary.permittedActions.includes("SEND_TEXT_TO_PAY");
    if (!hasPay) {
      paymentNote = "Payment policy disabled or amount not authorized";
    } else if (primary.phase === "COLLECT") {
      paymentNote = "Needs amount from authoritative source before Text-to-Pay";
    }
  }

  const matchedTitle =
    primary.intent === "EMERGENCY_OR_URGENT"
      ? "Emergency Handling"
      : primary.intent === "BOOKING_REQUEST"
        ? "Booking"
        : primary.intent === "PRICING_QUESTION"
          ? "Pricing"
          : intentLabel(primary.intent);

  return {
    detected: {
      primaryIntent: intentLabel(intent.primary_intent),
      secondaryIntents: secondaryLabels,
      urgency: intent.urgency,
      confidence: confidenceLabel(intent.confidence),
    },
    policy: {
      matchedPolicy: matchedTitle,
      status: policyStatusFromPlan(primary),
    },
    collect,
    actionPlan,
    executionSequence,
    immediateActions: immediate,
    blocked: buildBlockedLines(primary, bookingHealth),
    customerResponse: raw.draftCustomerResponse,
    domainEvents: events,
    paymentNote,
  };
}
