import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

/** Per-call runtime slice injected at turn time (optional at publish). */
export type VoiceCallPromptState = {
  callId?: string;
  currentState?: string;
  primaryIntent?: string | null;
  knownFields?: Record<string, string | null | undefined>;
  missingFields?: string[];
  allowedTools?: string[];
  workflowComplete?: boolean;
};

export type VoicePromptProfile = "after_hours" | "appointment_receptionist";

export type VoicePromptCompileInput = {
  wizard: AppointmentReceptionistWizardState;
  profile?: VoicePromptProfile;
  /** Live call/task overlay — omitted at Telnyx publish, injected per turn when supported. */
  callState?: VoiceCallPromptState;
  activeTask?: string;
  /** Runtime-resolved capability labels for the current state. */
  enabledCapabilities?: string[];
  /** Narrow RAG chunks — only when retrieval already ran. */
  retrievedKnowledge?: string;
  /** Omit empty sections to save tokens. */
  omitEmptySections?: boolean;
  /** When AI_BOOK, overrides after-hours link-only booking policy in compiled prompt. */
  voiceBookingMode?: "AI_BOOK" | "SEND_BOOKING_LINK" | "COLLECT_ONLY";
};

export type CompiledVoicePromptSectionId =
  | "identity"
  | "role"
  | "businessInformation"
  | "businessHours"
  | "services"
  | "approvedPricing"
  | "commonQuestions"
  | "businessPolicies"
  | "serviceArea"
  | "callHandling"
  | "workspacePolicy"
  | "allowedCapabilities"
  | "currentCallState"
  | "currentGoal"
  | "knownInformation"
  | "missingInformation"
  | "retrievedKnowledge"
  | "conversationRules"
  | "knowledgeHierarchy"
  | "safety"
  | "bookingPolicy"
  | "dateTimePolicy"
  | "transferPolicy"
  | "fallbackPolicy"
  | "toolPolicy"
  | "fieldCollection";

export type CompiledVoicePromptResult = {
  systemPrompt: string;
  sections: Partial<Record<CompiledVoicePromptSectionId, string>>;
  metadata: {
    compilerVersion: string;
    baseRulesVersion: string;
    profile: VoicePromptProfile;
    businessContextRevision: string;
    policyVersion?: string;
    includedSectionIds: CompiledVoicePromptSectionId[];
    ragIncluded: boolean;
    callStateIncluded: boolean;
  };
};

export type VoicePromptInspection = {
  metadata: CompiledVoicePromptResult["metadata"];
  sections: Partial<Record<CompiledVoicePromptSectionId, string>>;
  /** Truncated preview — safe for admin UI. */
  systemPromptPreview: string;
  systemPromptCharCount: number;
};
