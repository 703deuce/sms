import type { BusinessHoursWindow, VoiceV3CalendarConfig } from "../calendar/types";
import type { VoiceWizardBookingStrategy } from "@/lib/solutions/appointment-receptionist/types";

export type IntakeFieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "time";

export type IntakeCollectionStrategy =
  | "standard"
  | "voice_email"
  | "voice_phone"
  | "voice_address"
  | "voice_date";

export interface IntakeFieldDefinition {
  key: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  /** Model-facing semantic description — required for production agents. */
  description: string;
  collectionStrategy?: IntakeCollectionStrategy;
  verificationRequired?: boolean;
  /** When set, update_intake schema uses enum constraint (drive-through pattern). */
  enumValues?: string[];
}

export interface VoiceV3TransferDestination {
  id: string;
  label: string;
  description?: string;
  phoneE164?: string;
  enabled?: boolean;
}

export interface VoiceV3IntakeConfig {
  objectiveDescription?: string;
}

export type VoiceOperationRequirementKey =
  | "find_availability"
  | "book_appointment"
  | "find_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "send_booking_link"
  | "transfer_call";

export interface VoiceV3ServiceConfig {
  id: string;
  name: string;
  durationMinutes: number;
  slotStepMinutes: number;
  description?: string;
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
  /** GPT-Live prompt-controlled tuning (pace, accent, backchannels, etc.). */
  livePromptControls?: import("../prompts/live-prompt-controls").VoiceV3LivePromptControls;
}

export interface VoiceV3HotBusinessContext {
  companyDescription?: string;
  hoursDisplay?: string;
  hoursStructuredMeta?: VoiceV3StructuredBusinessHoursMeta;
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
  };
}

export interface VoiceV3SchedulingConfig {
  bookingStrategy: VoiceWizardBookingStrategy;
  primaryServiceId: string;
  services: VoiceV3ServiceConfig[];
  bookingBehavior: AppointmentReceptionistBookingBehavior;
}

/** Mirrors wizard bookingBehavior without importing wizard state in hot paths. */
export interface AppointmentReceptionistBookingBehavior {
  askPreferredDayFirst: boolean;
  offerEarliestThree: boolean;
  confirmBeforeBooking: boolean;
  sendSmsAfterBooking: boolean;
  askServiceFirst: boolean;
  distinguishNewExisting: boolean;
}

export interface VoiceV3TelephonyConfig {
  phoneNumberId: string | null;
  phoneNumberE164: string | null;
  answerWhen?: string;
  numberSource?: string;
  ringBehavior?: string;
  ringTeamSeconds?: number;
  outboundSmsMode?: string;
  outboundSmsPhoneNumberId?: string | null;
  outboundSmsE164?: string | null;
  callRecording: "off" | "all" | "inbound_only";
  connectionGreetingMode: string;
  connectionGreetingText?: string;
  connectionGreetingAudioUrl?: string;
  liveVoiceId: string;
  /** Built-in name or authorized custom voice id for accept params. */
  liveVoiceOutput?: string | { id: string };
  voiceLabel?: string;
  speaksFirst: "ai" | "caller";
  voiceSource?: "builtin" | "custom";
  openAiCustomVoiceId?: string | null;
}

export interface VoiceV3CallHandlingConfig {
  transferTriggers: string[];
  transferRingSeconds: number;
  transferFallback: string;
  warmTransfer: boolean;
  detectVoicemailOnTransfer: boolean;
  voiceV2HumanTransferEnabled: boolean;
  allowCallerRequestedTransfer: boolean;
  transferRouting: "single" | "waterfall";
  defaultTransferPlanId: string | null;
  transferPlanSteps: Array<{
    order?: number;
    destinationId: string;
    transferMode?: "BASIC" | "WARM";
    timeoutSeconds?: number;
  }>;
  urgencyEnabled: boolean;
  callbackRequestsEnabled: boolean;
  callbackUseAniByDefault: boolean;
  callbackAskPreferredTime: boolean;
  callbackConfirmNumber: boolean;
  salesSolicitationEnabled: boolean;
  salesSolicitationAction: string | null;
}

export interface VoiceV3QualificationConfig {
  enabled: boolean;
  requiredBeforePrimaryAction: boolean;
  revision: string | null;
  supportedZipCodes: string[];
  rulesMatchMode: "ALL" | "ANY" | null;
  notQualifiedFallback: string | null;
  needsReviewFallback: string | null;
  rules: unknown[];
}

export interface VoiceV3RecoveryConfig {
  aiCallRecoveryEnabled: boolean;
  consentMode: string | null;
  sendingPhoneNumberId: string | null;
  continueOverSms: boolean;
  delaySeconds: number | null;
  sendWhenCallbackCreated: boolean;
}

export interface VoiceV3IntegrationsConfig {
  crmEnabled: boolean;
  longTermMemory: boolean;
  calendarProvider: string | null;
  calendarConnected: boolean;
  calendarEmail: string | null;
}

export interface VoiceV3BookingStrategyConfig {
  strategy: VoiceWizardBookingStrategy;
  executionStatus: "ACTIVE_EXECUTION" | "CONFIGURED_NOT_IMPLEMENTED";
  bookingLinkUrl: string | null;
  bookingLinkLabel: string | null;
  sendLinkConsentRequired?: boolean;
  calendlyEventTypeUri: string | null;
  calendlyEventTypeName: string | null;
  calendlyEventTypeDurationMin: number | null;
  calendlyTimezone: string | null;
}

export interface VoiceV3StructuredBusinessHoursMeta {
  source: "operatingMaturity.businessSchedule.weekly";
  hoursProseConflictsWithStructured: boolean;
}

export interface VoiceV3ControlPlaneMeta {
  solutionName?: string;
  outcomeSlug?: string;
  preset?: string | null;
  testScenario?: string;
  activationMode?: string;
}

export interface VoiceV3AgentConfig {
  businessName: string;
  timezone: string;
  intake?: VoiceV3IntakeConfig;
  intakeFields: IntakeFieldDefinition[];
  operationRequirements?: Partial<Record<VoiceOperationRequirementKey, string[]>>;
  /** When set, transfer_call.destination is constrained to these ids. */
  transferDestinations?: VoiceV3TransferDestination[];
  /** Active default service (wizard primary selection). */
  service: VoiceV3ServiceConfig;
  /** All enabled bookable services from wizard appointment types. */
  services: VoiceV3ServiceConfig[];
  businessHours: BusinessHoursWindow;
  calendar?: VoiceV3CalendarConfig | null;

  identity: VoiceV3IdentityConfig;
  capabilities: VoiceV3CapabilityFlags;
  conversation: VoiceV3ConversationConfig;
  business: VoiceV3HotBusinessContext;
  scheduling: VoiceV3SchedulingConfig;
  knowledge: VoiceV3KnowledgeConfig;
  telephony: VoiceV3TelephonyConfig;
  controlPlane: VoiceV3ControlPlaneMeta;
  callHandling: VoiceV3CallHandlingConfig;
  qualification: VoiceV3QualificationConfig;
  recovery: VoiceV3RecoveryConfig;
  integrations: VoiceV3IntegrationsConfig;
  bookingStrategyDetail: VoiceV3BookingStrategyConfig;

  /** Hash / version for observability at accept time. */
  configVersion?: string;
  source?: "wizard_published" | "env_fallback" | "wizard_draft_test";
}
