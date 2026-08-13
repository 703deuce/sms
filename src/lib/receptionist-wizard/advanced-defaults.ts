import type { CapabilityId } from "./types";
import type {
  CallerFieldRow,
  DecisionRuleRow,
  IntentRuleRow,
  ReceptionistAdvancedSettings,
} from "./advanced-types";

export const DEFAULT_CALLER_FIELD_ROWS: CallerFieldRow[] = [
  {
    id: "name",
    label: "Full name",
    required: true,
    askWhen: "every_caller",
    confirm: false,
    enabled: true,
  },
  {
    id: "phone",
    label: "Phone number",
    required: true,
    askWhen: "new_callers",
    confirm: true,
    enabled: true,
  },
  {
    id: "email",
    label: "Email",
    required: false,
    askWhen: "when_booking",
    confirm: true,
    enabled: false,
  },
  {
    id: "reason",
    label: "Reason for calling",
    required: false,
    askWhen: "every_caller",
    confirm: false,
    enabled: true,
  },
  {
    id: "address",
    label: "Service address",
    required: false,
    askWhen: "service_inquiry",
    confirm: true,
    enabled: false,
  },
];

export const DEFAULT_INTENT_ROWS: IntentRuleRow[] = [
  { id: "new_customer", label: "New Customer", enabled: true },
  { id: "existing_customer", label: "Existing Customer", enabled: true },
  { id: "sales_inquiry", label: "Sales Inquiry", enabled: true },
  { id: "appointment_request", label: "Appointment Request", enabled: true },
  { id: "billing_question", label: "Billing Question", enabled: true },
  { id: "emergency", label: "Emergency", enabled: true },
  { id: "vendor_solicitor", label: "Vendor / Solicitor", enabled: true },
  { id: "other", label: "Other", enabled: true },
];

export const DEFAULT_DECISION_RULES: DecisionRuleRow[] = [
  {
    id: "emergency_transfer",
    condition: "Caller is an emergency",
    action: "transfer",
    target: "Emergency line",
  },
  {
    id: "human_transfer",
    condition: "Caller asks for a human",
    action: "transfer",
    target: "Main office",
  },
];

export function createDefaultAdvancedSettings(): ReceptionistAdvancedSettings {
  return {
    conversationBehavior: {
      responseLength: "balanced",
      style: "professional",
      allowInterrupt: true,
      confirmImportantDetails: true,
      repeatWhenUncertain: true,
      avoidDuplicateQuestions: true,
      handleOutOfOrderAnswers: true,
      allowAcknowledgments: true,
      fillerSpeech: "natural",
      silenceRepromptSec: 5,
    },
    callerFields: DEFAULT_CALLER_FIELD_ROWS.map((r) => ({ ...r })),
    intents: DEFAULT_INTENT_ROWS.map((r) => ({ ...r })),
    decisionRules: DEFAULT_DECISION_RULES.map((r) => ({ ...r })),
    bookingPolicy: {
      askPreferredDayFirst: true,
      offerEarliestAvailability: false,
      confirmDateTimeVerbally: true,
      sendSmsConfirmation: true,
      slotsToOffer: 3,
      minimumNoticeHours: 2,
    },
    transferPolicy: {
      warmTransfer: true,
      takeMessageOnFailure: true,
      notifyOnFailure: true,
      destinationE164: "",
      emergencyDestinationE164: "",
    },
    knowledgePolicy: {
      approvedKnowledgeOnly: true,
      allowGeneralAnswers: false,
      whenUncertain: "take_message",
    },
    actionPermissions: {
      takeMessages: true,
      updateContact: true,
      sendSms: true,
      bookAppointments: true,
      transferCalls: true,
      cancelAppointments: false,
      rescheduleAppointments: false,
    },
    fallbackPolicy: {
      maxMisunderstandAttempts: 2,
      onMisunderstand: "take_message",
      onBookingFail: "follow_up",
      onTransferFail: "take_message",
    },
    notifications: {
      sendCallSummary: true,
      notifyUrgent: true,
      notifyNewCustomers: true,
      notifyTransferFail: true,
      summaryDetail: "standard",
    },
  };
}

/** Align action toggles with capability selections from the main wizard. */
export function actionPermissionsFromCapabilities(
  capabilities: CapabilityId[],
  base = createDefaultAdvancedSettings().actionPermissions,
) {
  return {
    ...base,
    takeMessages: capabilities.includes("take_messages"),
    sendSms: capabilities.includes("send_text"),
    bookAppointments: capabilities.includes("book_appointments"),
    transferCalls: capabilities.includes("transfer_calls"),
  };
}
