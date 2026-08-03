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

export type KnowledgeItemStatus = "complete" | "warning" | "missing" | "optional";

export type BookingPermission =
  | "book_directly"
  | "suggest_then_confirm"
  | "send_booking_link"
  | "waitlist"
  | "require_deposit";

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
  telnyxAssistantId?: string | null;
  capabilities: CapabilityId[];
  answerWhen: AnswerWhen;
  solutionName: string;

  numberSource: NumberSource;
  phoneNumberId: string | null;
  phoneNumberE164: string | null;
  ringBehavior: "ai_immediate" | "ring_team_first" | "after_hours" | "custom";
  ringTeamSeconds: number;
  callRecording: "off" | "all" | "inbound_only";
  connectionGreeting: ConnectionGreetingMode;
  connectionGreetingText: string;

  knowledgeSource: KnowledgeSource;
  websiteUrl: string;
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
  }>;
  transferTriggers: string[];
  transferDestinationName: string;
  transferDestinationPhone: string;
  transferRingSeconds: number;
  transferFallback: FallbackAction;

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
  timezone: string;
};

export type WizardPersistAction = "save_draft" | "activate" | "create_draft";
