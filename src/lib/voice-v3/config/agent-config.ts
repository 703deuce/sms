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
  callRecording: "off" | "all" | "inbound_only";
  connectionGreetingMode: string;
  liveVoiceId: string;
  speaksFirst: "ai" | "caller";
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

  /** Hash / version for observability at accept time. */
  configVersion?: string;
  source?: "wizard_published" | "env_fallback";
}
