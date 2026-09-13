/**
 * Maps wizard configuration → shared Lead Recovery policy shape for voice runtime.
 * Wizard remains source of truth; LR workspace config overlays when explicitly saved.
 */
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { defaultIntentPolicies } from "@/lib/mctb/lead-recovery/policy-defaults";
import type {
  IntentPolicyShape,
  LeadRecoveryActionId,
  LeadRecoveryIntent,
  LeadRecoveryWorkspaceConfig,
} from "@/lib/mctb/lead-recovery/types";
import { evaluateLeadRecoveryPolicyForIntent } from "@/lib/mctb/lead-recovery/policy-engine";
import type { StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";
import type { LeadRecoveryConversationState } from "@/lib/mctb/lead-recovery/types";
import { isAfterHoursVoiceProfile } from "./voice-profile";

function wizardHasBookingLinkConfigured(wizard: AppointmentReceptionistWizardState): boolean {
  return wizard.appointmentTypes.some(
    (t) => t.enabled && t.bookingPermission === "send_booking_link",
  );
}

function bookingModeFromWizard(
  wizard: AppointmentReceptionistWizardState,
): "AI_BOOK" | "SEND_BOOKING_LINK" | "COLLECT_ONLY" {
  if (!wizard.capabilities.includes("book_appointments")) return "COLLECT_ONLY";
  // After-hours V1 never touches the calendar on the call — link or callback only.
  if (isAfterHoursVoiceProfile(wizard)) {
    return wizardHasBookingLinkConfigured(wizard) ? "SEND_BOOKING_LINK" : "COLLECT_ONLY";
  }
  if (wizard.calendarConnected) return "AI_BOOK";
  return wizardHasBookingLinkConfigured(wizard) ? "SEND_BOOKING_LINK" : "COLLECT_ONLY";
}

function actionCapabilitiesFromWizard(wizard: AppointmentReceptionistWizardState): LeadRecoveryActionId[] {
  const actions = new Set<LeadRecoveryActionId>([
    "COLLECT_FIELD",
    "CUSTOMER_MESSAGE",
    "SEND_EMAIL_SUMMARY",
    "CREATE_CALLBACK_REQUEST",
    "ANSWER_APPROVED_INFORMATION",
  ]);
  if (wizard.capabilities.includes("transfer_calls") && wizard.transferDestinationPhone?.trim()) {
    actions.add("ESCALATE_HUMAN");
    actions.add("ROUTE_TO_ON_CALL");
  }
  if (wizard.capabilities.includes("book_appointments")) {
    const mode = bookingModeFromWizard(wizard);
    if (mode === "AI_BOOK") actions.add("AI_BOOK");
    if (mode === "SEND_BOOKING_LINK") actions.add("SEND_BOOKING_LINK");
  }
  if (wizard.capabilities.includes("send_sms_confirmations")) {
    actions.add("SEND_OWNER_SMS");
  }
  return [...actions];
}

/** Derive LR-shaped workspace policy purely from wizard (no DB). */
export function deriveLeadRecoveryPolicyFromWizard(
  wizard: AppointmentReceptionistWizardState,
): LeadRecoveryWorkspaceConfig {
  const bookingMode = bookingModeFromWizard(wizard);
  const policies = defaultIntentPolicies(bookingMode);

  if (!wizard.capabilities.includes("book_appointments")) {
    policies.BOOKING_REQUEST = {
      enabled: true,
      collect: ["APPOINTMENT_PREFERENCE", "REASON"],
      actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
      customerMessage: "I can have someone from the team follow up about scheduling.",
    };
    policies.SPECIFIC_TIME_REQUEST = policies.BOOKING_REQUEST;
  }

  if (wizard.capabilities.includes("transfer_calls")) {
    const transferPolicy: IntentPolicyShape = {
      enabled: true,
      collect: ["REASON"],
      actions: ["ESCALATE_HUMAN", "CUSTOMER_MESSAGE"],
    };
    policies.COMPLAINT = {
      ...policies.COMPLAINT,
      enabled: true,
      actions: ["ESCALATE_HUMAN", "SEND_EMAIL_SUMMARY", "CUSTOMER_MESSAGE"],
    };
    policies.SENSITIVE_OR_HIGH_RISK = transferPolicy;
  }

  const captureOnly = isAfterHoursVoiceProfile(wizard);
  const bookingLinkMode = bookingModeFromWizard(wizard);

  if (captureOnly) {
    const bookingActions: LeadRecoveryActionId[] =
      bookingLinkMode === "SEND_BOOKING_LINK"
        ? [
            "SEND_BOOKING_LINK",
            "CREATE_CALLBACK_REQUEST",
            "CUSTOMER_MESSAGE",
            "SEND_EMAIL_SUMMARY",
          ]
        : ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE", "SEND_EMAIL_SUMMARY"];

    policies.BOOKING_REQUEST = {
      enabled: true,
      collect: ["NAME", "REASON", "CALLBACK_NUMBER", "ADDRESS", "SERVICE_CATEGORY"],
      actions: bookingActions,
      customerMessage:
        "I can text you our booking link so you can pick a time, or I can have the team call you back.",
    };
    policies.SPECIFIC_TIME_REQUEST = {
      enabled: true,
      collect: ["NAME", "REASON", "CALLBACK_NUMBER", "APPOINTMENT_PREFERENCE"],
      actions: bookingActions,
      customerMessage:
        "I can't hold or confirm a specific time on this line. I can text you the booking link or take a callback request.",
    };
  }

  return {
    enabled: true,
    version: 1,
    globalMode: captureOnly ? "STANDARD" : "STANDARD",
    enabledScenarios: {
      take_message: wizard.capabilities.includes("take_messages"),
      booking: wizard.capabilities.includes("book_appointments"),
      emergencies: true,
      pricing: wizard.capabilities.includes("answer_questions"),
      service_area: wizard.capabilities.includes("answer_questions"),
      general_faq: wizard.capabilities.includes("answer_questions"),
    },
    enabledIntents: Object.keys(policies) as LeadRecoveryIntent[],
    intentPolicies: policies,
    fallbackPolicy: {
      enabled: true,
      collect: ["NAME", "REASON", "CALLBACK_NUMBER"],
      actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE", "SEND_EMAIL_SUMMARY"],
      customerMessage: "I'll make sure the team gets your message.",
    },
    globalBehavior: {
      tone:
        wizard.tone === "friendly"
          ? "friendly"
          : wizard.tone === "concise"
            ? "concise"
            : "professional",
      maxClarificationAttempts: 2,
    },
    paymentPolicy: { textToPayEnabled: false },
    serviceAreaPolicy: {
      inAreaAction: "continue",
      outOfAreaAction: "notify",
      uncertainAction: "clarify_zip",
    },
    existingCustomerPolicy: { treatDifferently: wizard.bookingBehavior.distinguishNewExisting, actions: [] },
    faqPolicy: { topics: ["HOURS", "LOCATIONS", "SERVICES", "PRICING", "FAQ"], fallback: "clarify" },
    collectCapabilities: ["NAME", "PHONE", "REASON", "ADDRESS", "CALLBACK_NUMBER"],
    answerCapabilities: wizard.capabilities.includes("answer_questions")
      ? ["HOURS", "LOCATIONS", "SERVICE_AREA", "SERVICES", "PRICING", "FAQ"]
      : [],
    actionCapabilities: actionCapabilitiesFromWizard(wizard),
    handoffTriggers: {
      uncertain: true,
      complaint: true,
      sensitive: true,
      emergency: true,
      highValue: false,
    },
    policyHealth: "READY",
    scenarioHealth: {},
  };
}

/** Load workspace LR config when saved; otherwise derive from wizard snapshot. */
export async function resolveVoiceWorkspacePolicy(input: {
  workspaceId: string;
  wizard: AppointmentReceptionistWizardState;
}): Promise<{ config: LeadRecoveryWorkspaceConfig; source: "workspace" | "wizard" }> {
  try {
    const { loadLeadRecoveryConfig } = await import("@/lib/mctb/lead-recovery/config");
    const stored = await loadLeadRecoveryConfig(input.workspaceId);
    if (stored.enabled && Object.keys(stored.intentPolicies).length > 0) {
      return { config: stored, source: "workspace" };
    }
  } catch {
    // fall through to wizard-derived policy
  }
  return {
    config: deriveLeadRecoveryPolicyFromWizard(input.wizard),
    source: "wizard",
  };
}

export function policyVersionLabel(config: LeadRecoveryWorkspaceConfig, source: string): string {
  return `lr-${source}-v${config.version}`;
}

export function evaluateVoiceIntentPolicy(input: {
  config: LeadRecoveryWorkspaceConfig;
  intent: StructuredLeadIntent;
  collectedData?: Partial<Record<string, import("@/lib/mctb/lead-recovery/types").LeadRecoveryCollectField, string>>;
  conversationId?: string;
  workspaceId?: string;
}) {
  const conversationState: LeadRecoveryConversationState = {
    conversationId: input.conversationId || "voice",
    workspaceId: input.workspaceId || "voice",
    currentIntent: input.intent.primary_intent,
    secondaryIntents: input.intent.secondary_intents,
    leadType: input.intent.lead_type,
    urgency: input.intent.urgency,
    serviceCategory: input.intent.service_category,
    collectedFields: input.collectedData || {},
    missingFields: [],
    qualification: null,
    activeSpecialist: null,
    phase: "IDLE",
    clarificationAttempts: 0,
    lastIntent: input.intent,
    intentPlan: { pendingIntents: [], completedIntents: [], blockedIntents: [], currentIntent: null },
    updatedAt: new Date().toISOString(),
  };

  return evaluateLeadRecoveryPolicyForIntent({
    workspace: input.config,
    intent: input.intent,
    targetIntent: input.intent.primary_intent,
    collectedData: input.collectedData || {},
    conversationState,
  });
}
