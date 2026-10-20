/**
 * Minimal Voice V3 agent config shape for legacy prompt compilation in new-app.
 * Mirrors monolith `src/lib/voice-v3/config/agent-config.ts` fields used by prompts.
 */

export type IntakeFieldType = "text" | "email" | "phone" | "number" | "date" | "time";

export interface IntakeFieldDefinition {
  key: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  description?: string;
  verificationRequired?: boolean;
}

export interface VoiceV3TransferDestination {
  id: string;
  label: string;
  description?: string;
  phoneE164?: string;
  enabled?: boolean;
}

export interface VoiceV3CapabilityFlags {
  answerQuestions: boolean;
  collectIntake: boolean;
  checkAvailability: boolean;
  bookAppointments: boolean;
  findAppointments: boolean;
  rescheduleAppointments: boolean;
  cancelAppointments: boolean;
  transferCalls: boolean;
  sendSms: boolean;
  takeMessages: boolean;
  qualifyCallers: boolean;
}

export interface VoiceV3IdentityConfig {
  agentName: string;
}

export interface VoiceV3LivePromptControls {
  speakingPace: "slower" | "normal" | "faster";
  voiceAccent: string;
  backchannelLevel: "none" | "minimal" | "natural";
  callerPausePatience: "quick" | "normal" | "patient";
  interruptionStyle: "yield_immediately" | "natural";
}

export interface VoiceV3ConversationConfig {
  role: string;
  tone: string;
  speakingStyle: string;
  language: string;
  speaksFirst: "ai" | "caller";
  openingGreeting: string;
  conversationBehaviors: {
    keepBrief: boolean;
    oneQuestionAtATime: boolean;
    confirmDetails: boolean;
    neverInventPricing: boolean;
    neverInventAvailability: boolean;
  };
  guardrails: string[];
  livePromptControls?: VoiceV3LivePromptControls;
}

export interface VoiceV3HotBusinessContext {
  companyDescription?: string;
  hoursDisplay?: string;
  location?: string;
  serviceArea?: string;
  servicesSummary?: string;
  pricingSummary?: string;
  paymentMethods?: string;
  policiesSummary?: string;
  faqFacts?: string[];
  knowledgeItemSummaries?: Array<{ id: string; label: string; summary: string }>;
}

export interface VoiceV3KnowledgeConfig {
  hotContext: VoiceV3HotBusinessContext;
  retrieval: {
    enabled: boolean;
    knowledgeBaseIds: string[];
    websiteUrl?: string | null;
    documentSourceIds: string[];
    revision?: string | null;
    openaiVectorStoreIds?: string[];
  };
}

export interface VoiceV3ServiceConfig {
  id: string;
  name: string;
  durationMinutes: number;
  slotStepMinutes?: number;
  description?: string;
  enabled?: boolean;
  requiredIntakeKeys?: string[];
}

export type VoiceWizardBookingStrategy =
  | "MICROSOFT_365"
  | "GOOGLE"
  | "CALENDLY"
  | "REQUEST_ONLY"
  | "SEND_LINK"
  | "NONE";

export interface VoiceV3SchedulingConfig {
  bookingStrategy: VoiceWizardBookingStrategy;
  primaryServiceId: string;
  services: VoiceV3ServiceConfig[];
  bookingBehavior: {
    askPreferredDayFirst: boolean;
    offerEarliestThree: boolean;
    confirmBeforeBooking: boolean;
    sendSmsAfterBooking: boolean;
    askServiceFirst: boolean;
    distinguishNewExisting: boolean;
  };
}

export interface VoiceV3CallHandlingConfig {
  transferTriggers: string[];
  transferRingSeconds: number;
  transferFallback: string;
  warmTransfer: boolean;
  callbackRequestsEnabled: boolean;
  callbackUseAniByDefault: boolean;
  callbackAskPreferredTime: boolean;
  callbackConfirmNumber: boolean;
}

export interface VoiceV3SpamProtectionConfig {
  spamLikelyPolicy: "BLOCK" | "SCREEN" | "ALLOW" | null;
  solicitorPolicy: "DECLINE" | "TAKE_MESSAGE" | "ALLOW" | null;
}

export interface VoiceV3TransferPolicyCompiled {
  enabled: boolean;
  routes: Array<{ id: string; label: string; description: string }>;
  destinations: Array<{ id: string; label: string }>;
}

export interface VoiceV3AgentConfig {
  businessName: string;
  timezone: string;
  intakeFields: IntakeFieldDefinition[];
  transfer?: VoiceV3TransferPolicyCompiled;
  transferDestinations?: VoiceV3TransferDestination[];
  service: VoiceV3ServiceConfig;
  services: VoiceV3ServiceConfig[];
  businessHours: { timezone: string };
  identity: VoiceV3IdentityConfig;
  capabilities: VoiceV3CapabilityFlags;
  conversation: VoiceV3ConversationConfig;
  business: VoiceV3HotBusinessContext;
  scheduling: VoiceV3SchedulingConfig;
  knowledge: VoiceV3KnowledgeConfig;
  callHandling: VoiceV3CallHandlingConfig;
  spamProtection?: VoiceV3SpamProtectionConfig;
  workspaceId?: string;
  agentId?: string;
}
