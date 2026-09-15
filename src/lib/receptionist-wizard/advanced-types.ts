import type { VoiceV2IntakeWizardConfig } from "@/lib/voice-v2/intake/wizard-config";

/** Advanced receptionist settings — optional tuning beyond the main wizard steps. */

export type ResponseLength = "concise" | "balanced" | "detailed";
export type ConversationStyle = "friendly" | "professional" | "casual";
export type FillerSpeech = "minimal" | "natural" | "off";
export type SilenceRepromptSec = 3 | 5 | 8;
export type UncertainBehavior = "take_message" | "say_unknown" | "transfer";
export type AskWhenMode =
  | "every_caller"
  | "new_callers"
  | "when_booking"
  | "service_inquiry";

export type CallerFieldRow = {
  id: string;
  label: string;
  /** Optional collection question — used for custom fields. */
  question?: string;
  required: boolean;
  askWhen: AskWhenMode;
  confirm: boolean;
  enabled: boolean;
};

export type IntentRuleRow = {
  id: string;
  label: string;
  enabled: boolean;
  notes?: string;
};

export type DecisionRuleRow = {
  id: string;
  condition: string;
  action: string;
  target?: string;
};

export type ReceptionistAdvancedSettings = {
  conversationBehavior: {
    responseLength: ResponseLength;
    style: ConversationStyle;
    allowInterrupt: boolean;
    confirmImportantDetails: boolean;
    repeatWhenUncertain: boolean;
    avoidDuplicateQuestions: boolean;
    handleOutOfOrderAnswers: boolean;
    allowAcknowledgments: boolean;
    fillerSpeech: FillerSpeech;
    silenceRepromptSec: SilenceRepromptSec;
  };
  callerFields: CallerFieldRow[];
  intents: IntentRuleRow[];
  decisionRules: DecisionRuleRow[];
  bookingPolicy: {
    askPreferredDayFirst: boolean;
    offerEarliestAvailability: boolean;
    confirmDateTimeVerbally: boolean;
    sendSmsConfirmation: boolean;
    slotsToOffer: number;
    minimumNoticeHours: number;
  };
  transferPolicy: {
    warmTransfer: boolean;
    takeMessageOnFailure: boolean;
    notifyOnFailure: boolean;
    destinationE164: string;
    emergencyDestinationE164: string;
    whenToTransfer?: "caller_asks" | "certain_calls" | "instructions";
    transferInstructions?: string;
  };
  knowledgePolicy: {
    approvedKnowledgeOnly: boolean;
    allowGeneralAnswers: boolean;
    whenUncertain: UncertainBehavior;
  };
  actionPermissions: {
    takeMessages: boolean;
    updateContact: boolean;
    sendSms: boolean;
    bookAppointments: boolean;
    transferCalls: boolean;
    cancelAppointments: boolean;
    rescheduleAppointments: boolean;
  };
  fallbackPolicy: {
    maxMisunderstandAttempts: number;
    onMisunderstand: "take_message" | "transfer" | "repeat";
    onBookingFail: "follow_up" | "take_message" | "retry";
    onTransferFail: "take_message" | "retry" | "end_call";
  };
  notifications: {
    sendCallSummary: boolean;
    notifyUrgent: boolean;
    notifyNewCustomers: boolean;
    notifyTransferFail: boolean;
    summaryDetail: "short" | "standard" | "detailed";
    messageEmail?: string;
    messageSms?: string;
  };
  /** Voice V2 booking intake (Step 1) — persisted to agent advanced.voiceV2Intake */
  voiceV2Intake?: VoiceV2IntakeWizardConfig;
  /** Authoritative: live V2 save/find/book on Telnyx workflow (independent of after-hours greeting). */
  voiceV2PstnLiveBooking?: boolean;
};

export const RECEPTIONIST_ADVANCED_KEY = "receptionistAdvanced";
