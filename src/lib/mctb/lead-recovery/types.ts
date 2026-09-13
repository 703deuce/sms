/** Universal intent catalog — product-global meanings (not workspace-specific). */
export const LEAD_RECOVERY_INTENTS = [
  "GENERAL_INQUIRY",
  "SERVICE_REQUEST",
  "EMERGENCY_OR_URGENT",
  "CALLBACK_REQUEST",
  "BOOKING_REQUEST",
  "SPECIFIC_TIME_REQUEST",
  "PRICING_QUESTION",
  "ESTIMATE_REQUEST",
  "SERVICE_AREA_CHECK",
  "AVAILABILITY_QUESTION",
  "BUSINESS_HOURS",
  "BUSINESS_FAQ",
  "BUSINESS_LOCATION",
  "EXISTING_CUSTOMER_ISSUE",
  "RESCHEDULE_REQUEST",
  "CANCEL_REQUEST",
  "PAYMENT_REQUEST",
  "PAYMENT_STATUS_QUESTION",
  "COMPLAINT",
  "SENSITIVE_OR_HIGH_RISK",
  "WRONG_NUMBER",
  "OPT_OUT",
  "SPAM_VENDOR_RECRUITING",
  "LANGUAGE_PREFERENCE",
  "UNKNOWN",
] as const;

export type LeadRecoveryIntent = (typeof LEAD_RECOVERY_INTENTS)[number];

export type LeadRecoveryUrgency = "LOW" | "NORMAL" | "HIGH" | "EMERGENCY";
export type LeadRecoveryLeadType = "NEW" | "EXISTING" | "UNKNOWN";

export type LeadRecoveryCollectField =
  | "NAME"
  | "EMAIL"
  | "PHONE"
  | "ADDRESS"
  | "REASON"
  | "SERVICE_CATEGORY"
  | "ISSUE_DESCRIPTION"
  | "URGENCY"
  | "CALLBACK_NUMBER"
  | "CALLBACK_TIME"
  | "APPOINTMENT_PREFERENCE";

export const LEAD_RECOVERY_ACTIONS = [
  "COLLECT_FIELD",
  "SEND_BOOKING_LINK",
  "AI_BOOK",
  "CREATE_CALLBACK_REQUEST",
  "SEND_OWNER_SMS",
  "SEND_TEAM_SMS",
  "SEND_EMAIL_SUMMARY",
  "ROUTE_TO_TEAM",
  "ROUTE_TO_ON_CALL",
  "SEND_TEXT_TO_PAY",
  "CHECK_PAYMENT_STATUS",
  "ANSWER_APPROVED_INFORMATION",
  "ESCALATE_HUMAN",
  "END_AUTOMATION",
  "SUPPRESS_CONTACT",
  "FOLLOW_UP",
  "CUSTOMER_MESSAGE",
  "NO_OP",
] as const;

export type LeadRecoveryActionId = (typeof LEAD_RECOVERY_ACTIONS)[number];

export type LeadRecoveryGlobalMode = "STANDARD" | "CAPTURE_ONLY" | "INFORMATION_ONLY";

export type LeadRecoveryBookingMode =
  | "SEND_BOOKING_LINK"
  | "AI_BOOK"
  | "NOTIFY_BUSINESS"
  | "COLLECT_ONLY"
  | "DO_NOTHING";

export type LeadRecoveryPricingMode =
  | "APPROVED_PRICING"
  | "ESTIMATE_REQUIRED"
  | "COLLECT_AND_NOTIFY"
  | "ALWAYS_HANDOFF";

export type StructuredLeadIntent = {
  primary_intent: LeadRecoveryIntent;
  secondary_intents: LeadRecoveryIntent[];
  lead_type: LeadRecoveryLeadType;
  urgency: LeadRecoveryUrgency;
  service_category: string | null;
  reason_for_contact: string | null;
  location: { raw: string | null; resolved: string | null };
  requested_time: string | null;
  booking_requested: boolean;
  callback_requested: boolean;
  payment_intent: boolean;
  complaint: boolean;
  human_required: boolean;
  language: string;
  confidence: number;
  missing_required_fields: LeadRecoveryCollectField[];
};

export type IntentPolicyShape = {
  enabled: boolean;
  collect: LeadRecoveryCollectField[];
  mode?: LeadRecoveryBookingMode | LeadRecoveryPricingMode | null;
  actions: LeadRecoveryActionId[];
  customerMessage?: string | null;
  conditions?: Array<{
    field: string;
    op: "eq" | "neq" | "in";
    value: string | string[];
  }>;
  providerConfiguration?: Record<string, unknown>;
  escalation?: { escalateHuman?: boolean };
};

export type LeadRecoveryScenarioKey =
  | "take_message"
  | "booking"
  | "emergencies"
  | "pricing"
  | "service_area"
  | "payments"
  | "existing_customer"
  | "general_faq";

export type LeadRecoveryGlobalBehavior = {
  tone?: "professional" | "friendly" | "concise";
  maxClarificationAttempts?: number;
  followUpEnabled?: boolean;
  followUpDelayMinutes?: number;
  captureOnly?: boolean;
};

export type LeadRecoveryPaymentPolicy = {
  textToPayEnabled?: boolean;
  amountAuthority?: "known_balance" | "configured_fixed_fee" | "operator_payment_request";
  fixedFeeAmountMinor?: number | null;
  fixedFeeCurrency?: string;
};

export type LeadRecoveryServiceAreaPolicy = {
  source?: "workspace" | "manual";
  inAreaAction?: "continue" | "booking_link" | "ai_book" | "callback" | "notify";
  outOfAreaAction?: "decline" | "notify" | "handoff";
  uncertainAction?: "clarify_zip" | "handoff" | "notify";
};

export type LeadRecoveryExistingCustomerPolicy = {
  treatDifferently: boolean;
  actions: LeadRecoveryActionId[];
  notifyRecipientId?: string | null;
};

export type LeadRecoveryFaqPolicy = {
  topics: LeadRecoveryWorkspaceConfig["answerCapabilities"];
  fallback: "clarify" | "notify" | "handoff";
};

export type PolicyHealthStatus =
  | "READY"
  | "NEEDS_CONFIGURATION"
  | "PROVIDER_BLOCKED"
  | "UPGRADE_REQUIRED"
  | "DISABLED";

export type LeadRecoveryWorkspaceConfig = {
  enabled: boolean;
  version: number;
  globalMode: LeadRecoveryGlobalMode;
  enabledScenarios: Partial<Record<LeadRecoveryScenarioKey, boolean>>;
  enabledIntents: LeadRecoveryIntent[];
  intentPolicies: Partial<Record<LeadRecoveryIntent, IntentPolicyShape>>;
  fallbackPolicy: IntentPolicyShape;
  globalBehavior: LeadRecoveryGlobalBehavior;
  paymentPolicy: LeadRecoveryPaymentPolicy;
  serviceAreaPolicy: LeadRecoveryServiceAreaPolicy;
  existingCustomerPolicy: LeadRecoveryExistingCustomerPolicy;
  faqPolicy: LeadRecoveryFaqPolicy;
  migratedFromAiBooking?: boolean;
  collectCapabilities: LeadRecoveryCollectField[];
  answerCapabilities: Array<
    "HOURS" | "LOCATIONS" | "SERVICE_AREA" | "SERVICES" | "PRICING" | "FAQ" | "BOOKING_AVAILABILITY"
  >;
  actionCapabilities: LeadRecoveryActionId[];
  handoffTriggers: {
    uncertain: boolean;
    complaint: boolean;
    sensitive: boolean;
    emergency: boolean;
    highValue: boolean;
  };
  bookingLinkId?: string | null;
  policyHealth: PolicyHealthStatus;
  scenarioHealth: Partial<Record<LeadRecoveryScenarioKey, PolicyHealthStatus>>;
};

export type IntentExecutionPlanState = {
  pendingIntents: LeadRecoveryIntent[];
  completedIntents: LeadRecoveryIntent[];
  blockedIntents: LeadRecoveryIntent[];
  currentIntent: LeadRecoveryIntent | null;
};

export type MultiIntentPolicyResult = {
  primary: PolicyEvaluationResult;
  secondaryPlans: Array<{ intent: LeadRecoveryIntent; plan: PolicyEvaluationResult }>;
  executionPlan: IntentExecutionPlanState;
};

export type LeadRecoveryPendingAction = {
  action: LeadRecoveryActionId;
  epoch: number;
  idempotencyKey?: string;
};

export type LeadRecoveryConversationState = {
  conversationId: string;
  workspaceId: string;
  currentIntent: LeadRecoveryIntent | null;
  secondaryIntents: LeadRecoveryIntent[];
  leadType: LeadRecoveryLeadType;
  urgency: LeadRecoveryUrgency;
  serviceCategory: string | null;
  collectedFields: Partial<Record<LeadRecoveryCollectField, string>>;
  missingFields: LeadRecoveryCollectField[];
  qualification: string | null;
  activeSpecialist: "SCHEDULING" | null;
  activeAction: LeadRecoveryActionId | null;
  /** Monotonic version — bumps on each inbound; used to invalidate stale side effects. */
  stateVersion?: number;
  pendingActionEpoch?: number;
  pendingAction?: LeadRecoveryPendingAction | null;
  /** Telnyx/Twilio inbound message IDs already processed for this conversation. */
  processedInboundIds?: string[];
  phase: "IDLE" | "COLLECT" | "EXECUTE" | "AWAITING_SLOT_SELECTION" | "COMPLETE";
  clarificationAttempts: number;
  lastIntent: StructuredLeadIntent | null;
  intentPlan: IntentExecutionPlanState;
  paymentAmountRequired?: boolean;
  updatedAt: string;
};

export type PolicyEvaluationResult = {
  intent: LeadRecoveryIntent;
  matchedPolicyId: string;
  phase: "COLLECT" | "EXECUTE" | "CLARIFY" | "HANDOFF";
  missingFields: LeadRecoveryCollectField[];
  nextActions: Array<{
    action: LeadRecoveryActionId;
    field?: LeadRecoveryCollectField;
    config?: Record<string, unknown>;
  }>;
  blockedActions: Array<{ action: LeadRecoveryActionId; blockedBy: LeadRecoveryCollectField[] }>;
  permittedActions: LeadRecoveryActionId[];
  responseConstraints: {
    customerMessageTemplate?: string | null;
    mustNotInventPricing: boolean;
    mustNotInventAvailability: boolean;
  };
  escalation: boolean;
};

export type LeadRecoveryInboundResult =
  | { handled: false; reason?: string }
  | {
      handled: true;
      reply: string;
      action: string;
      policy?: PolicyEvaluationResult;
      intent?: StructuredLeadIntent;
    };
