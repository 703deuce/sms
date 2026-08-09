export type CollectFieldConfig = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  question: string;
  enabled: boolean;
  askOrder: number;
};

export type ConversationFieldProfile = {
  id: string;
  description: string;
  collectFields: CollectFieldConfig[];
};

/** Field collection configs used by the text conversation simulator. */
export const CONVERSATION_FIELD_PROFILES: Record<string, ConversationFieldProfile> = {
  "email-intake": {
    id: "email-intake",
    description: "Name, phone, email, problem, then address (original toilet-leak profile).",
    collectFields: [
      { id: "name", label: "Name", type: "text", required: true, question: "Your name?", enabled: true, askOrder: 1 },
      { id: "phone", label: "Phone", type: "phone", required: true, question: "Phone?", enabled: true, askOrder: 2 },
      { id: "email", label: "Email", type: "email", required: true, question: "Email?", enabled: true, askOrder: 3 },
      { id: "fld_problem", label: "Problem", type: "long_text", required: true, question: "What's the issue?", enabled: true, askOrder: 4 },
      { id: "fld_service_address", label: "Address", type: "text", required: true, question: "Service address?", enabled: true, askOrder: 5 },
    ],
  },
  "phone-first-no-email": {
    id: "phone-first-no-email",
    description: "Name, phone, address, problem — no email required.",
    collectFields: [
      { id: "name", label: "Name", type: "text", required: true, question: "May I have your name?", enabled: true, askOrder: 1 },
      { id: "phone", label: "Phone", type: "phone", required: true, question: "What's the best callback number?", enabled: true, askOrder: 2 },
      { id: "fld_service_address", label: "Service address", type: "text", required: true, question: "What's the service address?", enabled: true, askOrder: 3 },
      { id: "fld_problem", label: "Problem", type: "long_text", required: true, question: "Can you describe the problem?", enabled: true, askOrder: 4 },
    ],
  },
};

export function getFieldProfile(id: string): ConversationFieldProfile {
  const profile = CONVERSATION_FIELD_PROFILES[id];
  if (!profile) {
    throw new Error(
      `Unknown field profile "${id}". Available: ${Object.keys(CONVERSATION_FIELD_PROFILES).join(", ")}`,
    );
  }
  return profile;
}

export function resolveFieldProfileForScenario(scenarioId: string, explicitProfileId?: string): ConversationFieldProfile {
  if (explicitProfileId) return getFieldProfile(explicitProfileId);
  if (scenarioId === "garbage-disposal-phone-first") {
    return getFieldProfile("phone-first-no-email");
  }
  return getFieldProfile("email-intake");
}
