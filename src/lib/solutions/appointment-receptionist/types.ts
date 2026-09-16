export const WIZARD_STEPS = [
  { id: "goals", label: "Goals" },
  { id: "phone", label: "Phone" },
  { id: "information", label: "Information" },
  { id: "appointments", label: "Appointments" },
  { id: "call-handling", label: "Call Handling" },
  { id: "voice", label: "Voice" },
  { id: "test", label: "Test" },
  { id: "activate", label: "Activate" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export type CapabilityId =
  | "answer_questions"
  | "book_appointments"
  | "reschedule"
  | "cancel"
  | "take_messages"
  | "qualify_callers"
  | "transfer_calls"
  | "send_sms_confirmations";

export type AnswerWhen =
  | "every_call"
  | "nobody_answers"
  | "after_hours"
  | "line_busy"
  | "custom_schedule";

export type NumberSource =
  | "existing"
  | "buy_new"
  | "connect_existing"
  | "forward_existing";

export type ConnectionGreetingMode =
  | "none"
  | "transovo_professional"
  | "transovo_warm"
  | "upload_custom"
  | "create_custom";

export type KnowledgeSource =
  | "website"
  | "guided_profile"
  | "upload_docs"
  | "connect_data";

export type KnowledgeItemStatus =
  | "complete"
  | "warning"
  | "missing"
  | "optional"
  | "pending_review"
  | "extracted"
  | "owner_approved"
  | "rejected"
  | "outdated";

export type BookingPermission =
  | "book_directly"
  | "suggest_then_confirm"
  | "send_booking_link"
  | "waitlist"
  | "require_deposit";

/** Published Voice V2 booking mode (wizard control plane). */
export type VoiceWizardBookingStrategy =
  | "NONE"
  | "REQUEST_ONLY"
  | "SEND_LINK"
  | "MICROSOFT_365"
  | "CALENDLY";

export type FallbackAction =
  | "return_to_ai"
  | "take_message"
  | "notify_staff"
  | "voicemail"
  | "offer_appointment"
  | "send_text";

export type ActivationMode =
  | "activate_now"
  | "schedule"
  | "save_draft"
  | "duplicate_location";

export type TestScenarioId =
  | "business_question"
  | "price_question"
  | "appointment_booking"
  | "no_availability"
  | "transfer"
  | "frustrated"
  | "tool_failure";

export type AppointmentTypeConfig = {
  id: string;
  name: string;
  durationMin: number;
  calendar: string;
  status: "ready" | "needs_rules";
  location?: string;
  modality?: "in_person" | "phone" | "video";
  description?: string;
  bookingHours?: string;
  minNotice?: string;
  maxDaysAhead?: string;
  requiredFields: string[];
  bookingPermission: BookingPermission;
  enabled: boolean;
};

export type AppointmentReceptionistWizardState = {
  agentId?: string;
  /** Durable SolutionSetup id — set after first save. */
  setupId?: string;
  /** Outcome registry slug this wizard run represents (e.g. appointment-booking). */
  outcomeSlug?: string;
  /** URL preset that seeded this run (e.g. every_call). */
  preset?: string | null;
  telnyxAssistantId?: string | null;
  capabilities: CapabilityId[];
  answerWhen: AnswerWhen;
  solutionName: string;

  numberSource: NumberSource;
  phoneNumberId: string | null;
  phoneNumberE164: string | null;
  /**
   * Outbound SMS for voice tools (booking links). Independent of voice inbound DID.
   * When unset, toll-free voice → workspace preferred texting number (e.g. 571).
   */
  outboundSmsMode?: "auto" | "workspace_preferred" | "same_as_voice_line" | "explicit_number";
  outboundSmsPhoneNumberId?: string | null;
  outboundSmsE164?: string | null;
  ringBehavior: "ai_immediate" | "ring_team_first" | "after_hours" | "custom" | "line_busy";
  ringTeamSeconds: number;
  callRecording: "off" | "all" | "inbound_only";
  connectionGreeting: ConnectionGreetingMode;
  connectionGreetingText: string;
  /** HTTPS URL for upload_custom connection greeting audio. */
  connectionGreetingAudioUrl?: string;

  knowledgeSource: KnowledgeSource;
  websiteUrl: string;
  /** Optional existing VoiceKnowledgeBase to attach on save/activate. */
  linkedKnowledgeBaseId?: string | null;
  /** Large document KB search (RAG) — composable with any bookingStrategy. */
  knowledgeBaseEnabled?: boolean | null;
  knowledgeBaseRevision?: string | null;
  knowledgeItems: Array<{
    id: string;
    label: string;
    summary: string;
    status: KnowledgeItemStatus;
    statusLabel: string;
  }>;

  calendarProvider: string | null;
  calendarConnected: boolean;
  calendarEmail: string | null;
  appointmentTypes: AppointmentTypeConfig[];
  selectedAppointmentTypeId: string | null;
  /** What Amy does when a caller wants an appointment (maps to published bookingStrategy). */
  bookingStrategy?: VoiceWizardBookingStrategy | null;
  /** Trusted booking URL when bookingStrategy is SEND_LINK. */
  bookingLinkUrl?: string | null;
  bookingLinkLabel?: string | null;
  /** Calendly event type for bookingStrategy CALENDLY */
  calendlyEventTypeUri?: string | null;
  calendlyEventTypeName?: string | null;
  calendlyEventTypeDurationMin?: number | null;
  calendlyTimezone?: string | null;

  bookingBehavior: {
    askPreferredDayFirst: boolean;
    offerEarliestThree: boolean;
    confirmBeforeBooking: boolean;
    sendSmsAfterBooking: boolean;
    askServiceFirst: boolean;
    distinguishNewExisting: boolean;
  };
  collectFields: Array<{
    id: string;
    label: string;
    required: boolean;
    enabled: boolean;
    /** When true, field participates in deterministic lead qualification rules. */
    useForQualification?: boolean;
  }>;
  /** Lead qualification / caller triage (composable with any bookingStrategy). */
  qualificationEnabled?: boolean | null;
  qualificationRequiredBeforePrimaryAction?: boolean | null;
  qualificationRevision?: string | null;
  qualificationSupportedZipCodes?: string[];
  qualificationRulesMatchMode?: "ALL" | "ANY" | null;
  qualificationNotQualifiedFallback?:
    | "TAKE_MESSAGE"
    | "REQUEST_APPOINTMENT"
    | "SEND_BOOKING_LINK"
    | "CONTINUE_PRIMARY_MODE"
    | null;
  qualificationNeedsReviewFallback?:
    | "TAKE_MESSAGE"
    | "REQUEST_APPOINTMENT"
    | "SEND_BOOKING_LINK"
    | "CONTINUE_PRIMARY_MODE"
    | null;
  qualificationRules?: import("@/lib/voice-v2/qualification-types").VoiceV2QualificationRuleRow[];
  transferTriggers: string[];
  transferDestinationName: string;
  transferDestinationPhone: string;
  transferRingSeconds: number;
  transferFallback: FallbackAction;
  /** Prefer warm (consult) transfer when transferring to a human. */
  warmTransfer: boolean;
  /** Run answering-machine detection on transfer legs. */
  detectVoicemailOnTransfer: boolean;
  /** Voice V2 PSTN human transfer (Call Handling). */
  voiceV2HumanTransferEnabled?: boolean | null;
  allowCallerRequestedTransfer?: boolean | null;
  transferRouting?: "single" | "waterfall" | null;
  defaultTransferPlanId?: string | null;
  transferDestinations?: Array<{
    id: string;
    label: string;
    phoneE164: string;
    enabled?: boolean;
  }>;
  transferPlanSteps?: Array<{
    order?: number;
    destinationId: string;
    transferMode?: "BASIC" | "WARM";
    timeoutSeconds?: number;
  }>;
  urgencyEnabled?: boolean | null;
  urgencyRules?: import("@/lib/voice-v2/after-hours-handling-types").VoiceV2UrgencyRuleRow[];
  callbackRequestsEnabled?: boolean | null;
  callbackUseAniByDefault?: boolean | null;
  callbackAskPreferredTime?: boolean | null;
  callbackConfirmNumber?: boolean | null;
  salesSolicitationEnabled?: boolean | null;
  salesSolicitationAction?:
    | import("@/lib/voice-v2/after-hours-handling-types").VoiceV2SalesSolicitationAction
    | null;

  /** Voice V2 — AI Call Recovery (unresolved AI voice → SMS text-agent continuation). */
  aiCallRecoveryEnabled?: boolean | null;
  aiCallRecoveryConsentMode?:
    | import("@/lib/voice-v2/ai-call-recovery/types").VoiceV2AiCallRecoveryConsentMode
    | null;
  aiCallRecoverySendingPhoneNumberId?: string | null;
  aiCallRecoveryContinueOverSms?: boolean | null;
  aiCallRecoveryDelaySeconds?: number | null;
  aiCallRecoverySendWhenCallbackCreated?: boolean | null;

  agentName: string;
  businessName: string;
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

  voiceId: string;
  voiceLabel: string;
  speakingSpeed: number;
  responsiveness: number;
  interruptionSensitivity: number;

  testScenario: TestScenarioId;
  lastTestPassed: boolean | null;

  activationMode: ActivationMode;
  /** ISO datetime for schedule activation mode. */
  scheduledAt?: string | null;
  /** Opt-in long-term caller memory (VoiceMemoryConfig). */
  longTermMemory: boolean;
  /** Enable CRM note/contact tools alongside message taking. */
  crmEnabled: boolean;
  timezone: string;

  /** Voice V2 operating maturity (hours, on-call, SLA) — pinned at publish. */
  operatingMaturity?: import("@/lib/voice-v2/operating-maturity/types").VoiceV2OperatingMaturityPublishedConfig;
  qualityStudioLastRun?: {
    configHash: string;
    testedAt: string;
    publishBlockers?: string[];
  };
};

export type WizardPersistAction = "save_draft" | "activate" | "create_draft";
