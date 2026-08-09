import type { WizardCollectField } from "@/lib/agents/appointment-booking/collection-fields";

export type ConversationWizardProfile = {
  id: string;
  description: string;
  /** Same slim shape the Appointments step saves: { id, label, required, enabled }. */
  collectFields: WizardCollectField[];
};

/**
 * Field profiles expressed exactly as the appointment-receptionist wizard saves them.
 * These flow through buildWizardAgentConfig → draftConfig.conversationFlow.sections[booking].config.collectFields.
 */
export const CONVERSATION_WIZARD_PROFILES: Record<string, ConversationWizardProfile> = {
  "email-intake": {
    id: "email-intake",
    description: "Frontend default order: name, phone, email, problem (notes), address.",
    collectFields: [
      { id: "full_name", label: "Full name", required: true, enabled: true },
      { id: "phone", label: "Phone number", required: true, enabled: true },
      { id: "email", label: "Email", required: true, enabled: true },
      { id: "notes", label: "Problem description", required: true, enabled: true },
      { id: "address", label: "Service address", required: true, enabled: true },
      { id: "service", label: "Service requested", required: false, enabled: false },
    ],
  },
  "phone-address-problem": {
    id: "phone-address-problem",
    description: "Name, phone, address, problem — email disabled (as configured in the wizard UI).",
    collectFields: [
      { id: "full_name", label: "Full name", required: true, enabled: true },
      { id: "phone", label: "Phone number", required: true, enabled: true },
      { id: "address", label: "Service address", required: true, enabled: true },
      { id: "notes", label: "Problem description", required: true, enabled: true },
      { id: "email", label: "Email", required: false, enabled: false },
      { id: "service", label: "Service requested", required: false, enabled: false },
    ],
  },
};

export function getWizardProfile(id: string): ConversationWizardProfile {
  const profile = CONVERSATION_WIZARD_PROFILES[id];
  if (!profile) {
    throw new Error(
      `Unknown wizard profile "${id}". Available: ${Object.keys(CONVERSATION_WIZARD_PROFILES).join(", ")}`,
    );
  }
  return profile;
}

export function resolveWizardProfileForScenario(
  scenarioId: string,
  explicitProfileId?: string,
): ConversationWizardProfile {
  if (explicitProfileId) return getWizardProfile(explicitProfileId);
  if (scenarioId === "garbage-disposal-phone-first") {
    return getWizardProfile("phone-address-problem");
  }
  return getWizardProfile("email-intake");
}

export function enabledRequiredFieldIds(collectFields: WizardCollectField[]): string[] {
  return collectFields.filter((f) => f.enabled !== false && f.required).map((f) => f.id);
}
