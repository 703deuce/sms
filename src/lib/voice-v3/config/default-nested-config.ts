import type {
  AppointmentReceptionistBookingBehavior,
  VoiceV3AgentConfig,
  VoiceV3CapabilityFlags,
  VoiceV3ConversationConfig,
  VoiceV3ControlPlaneMeta,
  VoiceV3HotBusinessContext,
  VoiceV3IdentityConfig,
  VoiceV3KnowledgeConfig,
  VoiceV3SchedulingConfig,
  VoiceV3ServiceConfig,
  VoiceV3TelephonyConfig,
  VoiceV3CallHandlingConfig,
  VoiceV3QualificationConfig,
  VoiceV3RecoveryConfig,
  VoiceV3IntegrationsConfig,
  VoiceV3BookingStrategyConfig,
} from "./agent-config";
import { VOICE_V3_DEFAULT_SPAM_PROTECTION } from "../spam-protection/types";

export const DEFAULT_V3_CALL_HANDLING: VoiceV3CallHandlingConfig = {
  transferTriggers: [],
  transferRingSeconds: 30,
  transferFallback: "take_message",
  warmTransfer: false,
  detectVoicemailOnTransfer: false,
  voiceV2HumanTransferEnabled: false,
  allowCallerRequestedTransfer: true,
  transferRouting: "single",
  defaultTransferPlanId: null,
  transferPlanSteps: [],
  urgencyEnabled: false,
  callbackRequestsEnabled: true,
  callbackUseAniByDefault: true,
  callbackAskPreferredTime: true,
  callbackConfirmNumber: true,
  salesSolicitationEnabled: false,
  salesSolicitationAction: null,
};

export const DEFAULT_V3_QUALIFICATION: VoiceV3QualificationConfig = {
  enabled: false,
  requiredBeforePrimaryAction: false,
  revision: null,
  supportedZipCodes: [],
  rulesMatchMode: null,
  notQualifiedFallback: null,
  needsReviewFallback: null,
  rules: [],
};

export const DEFAULT_V3_RECOVERY: VoiceV3RecoveryConfig = {
  aiCallRecoveryEnabled: false,
  consentMode: null,
  sendingPhoneNumberId: null,
  continueOverSms: false,
  delaySeconds: null,
  sendWhenCallbackCreated: false,
};

export const DEFAULT_V3_INTEGRATIONS: VoiceV3IntegrationsConfig = {
  crmEnabled: false,
  longTermMemory: false,
  calendarProvider: null,
  calendarConnected: false,
  calendarEmail: null,
};

export const DEFAULT_V3_BOOKING_STRATEGY: VoiceV3BookingStrategyConfig = {
  strategy: "MICROSOFT_365",
  executionStatus: "ACTIVE_EXECUTION",
  bookingLinkUrl: null,
  bookingLinkLabel: null,
  calendlyEventTypeUri: null,
  calendlyEventTypeName: null,
  calendlyEventTypeDurationMin: null,
  calendlyTimezone: null,
};

export const DEFAULT_V3_CONVERSATION: VoiceV3ConversationConfig = {
  role: "Front-desk receptionist",
  tone: "Warm and professional",
  speakingStyle: "Brief and conversational",
  language: "English",
  speaksFirst: "ai",
  openingGreeting:
    "Thank you for calling {{businessName}}. This is {{agentName}}. How can I help you today?",
  conversationBehaviors: {
    keepBrief: true,
    oneQuestionAtATime: true,
    confirmDetails: true,
    neverInventPricing: true,
    neverInventAvailability: true,
  },
  guardrails: [],
};

export const DEFAULT_V3_CAPABILITIES: VoiceV3CapabilityFlags = {
  answerQuestions: true,
  collectIntake: true,
  checkAvailability: true,
  bookAppointments: true,
  findAppointments: true,
  rescheduleAppointments: true,
  cancelAppointments: true,
  transferCalls: true,
  sendSms: true,
  takeMessages: true,
  qualifyCallers: false,
};

export function defaultNestedFromFlat(input: {
  businessName: string;
  timezone: string;
  service: VoiceV3ServiceConfig;
  agentName?: string;
}): Pick<
  VoiceV3AgentConfig,
  | "identity"
  | "capabilities"
  | "conversation"
  | "business"
  | "scheduling"
  | "knowledge"
  | "telephony"
  | "controlPlane"
  | "services"
  | "callHandling"
  | "qualification"
  | "recovery"
  | "integrations"
  | "bookingStrategyDetail"
> {
  const agentName = input.agentName?.trim() || "Amy";
  const defaultBooking: AppointmentReceptionistBookingBehavior = {
    askPreferredDayFirst: true,
    offerEarliestThree: true,
    confirmBeforeBooking: true,
    sendSmsAfterBooking: false,
    askServiceFirst: true,
    distinguishNewExisting: false,
  };

  return {
    identity: { agentName },
    capabilities: { ...DEFAULT_V3_CAPABILITIES },
    conversation: {
      ...DEFAULT_V3_CONVERSATION,
      openingGreeting: DEFAULT_V3_CONVERSATION.openingGreeting,
    },
    business: { companyDescription: undefined, hoursDisplay: undefined },
    scheduling: {
      bookingStrategy: "MICROSOFT_365",
      primaryServiceId: input.service.id,
      services: [input.service],
      bookingBehavior: defaultBooking,
    },
    services: [input.service],
    knowledge: {
      hotContext: {},
      retrieval: { enabled: false, knowledgeBaseIds: [], documentSourceIds: [] },
    },
    telephony: {
      phoneNumberId: null,
      phoneNumberE164: null,
      callRecording: "off",
      connectionGreetingMode: "none",
      liveVoiceId: "marin",
      speaksFirst: "ai",
    },
    controlPlane: {},
    callHandling: { ...DEFAULT_V3_CALL_HANDLING },
    spamProtection: { ...VOICE_V3_DEFAULT_SPAM_PROTECTION },
    qualification: { ...DEFAULT_V3_QUALIFICATION },
    recovery: { ...DEFAULT_V3_RECOVERY },
    integrations: { ...DEFAULT_V3_INTEGRATIONS },
    bookingStrategyDetail: { ...DEFAULT_V3_BOOKING_STRATEGY },
  };
}

export function mergeNestedConfig(
  base: VoiceV3AgentConfig,
  patch: Partial<
    Pick<
      VoiceV3AgentConfig,
      | "identity"
      | "capabilities"
      | "conversation"
      | "business"
      | "scheduling"
      | "knowledge"
      | "telephony"
      | "controlPlane"
      | "services"
      | "transferDestinations"
      | "callHandling"
      | "spamProtection"
      | "qualification"
      | "recovery"
      | "integrations"
      | "bookingStrategyDetail"
    >
  >,
): VoiceV3AgentConfig {
  return {
    ...base,
    ...patch,
    identity: { ...base.identity, ...patch.identity },
    capabilities: { ...base.capabilities, ...patch.capabilities },
    conversation: { ...base.conversation, ...patch.conversation },
    business: { ...base.business, ...patch.business },
    scheduling: { ...base.scheduling, ...patch.scheduling },
    knowledge: {
      hotContext: { ...base.knowledge.hotContext, ...patch.knowledge?.hotContext },
      retrieval: { ...base.knowledge.retrieval, ...patch.knowledge?.retrieval },
    },
    telephony: { ...base.telephony, ...patch.telephony },
    controlPlane: { ...base.controlPlane, ...patch.controlPlane },
    services: patch.services ?? base.services,
    transferDestinations: patch.transferDestinations ?? base.transferDestinations,
    callHandling: { ...base.callHandling, ...patch.callHandling },
    spamProtection: { ...base.spamProtection, ...patch.spamProtection },
    qualification: { ...base.qualification, ...patch.qualification },
    recovery: { ...base.recovery, ...patch.recovery },
    integrations: { ...base.integrations, ...patch.integrations },
    bookingStrategyDetail: {
      ...base.bookingStrategyDetail,
      ...patch.bookingStrategyDetail,
    },
  };
}
