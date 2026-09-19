import type { CapabilityId } from "@/lib/solutions/appointment-receptionist/types";

/** Repeatable collection item properties — schema paths (not runtime indices). */

export const WIZARD_CAPABILITY_CONTROL_PATHS: readonly string[] = [
  "answer_questions",
  "book_appointments",
  "reschedule",
  "cancel",
  "take_messages",
  "qualify_callers",
  "transfer_calls",
  "send_sms_confirmations",
].map((c) => `capabilities.${c as CapabilityId}`);

export const WIZARD_COLLECT_FIELD_CONTROL_PATHS = [
  "collectFields[].id",
  "collectFields[].label",
  "collectFields[].required",
  "collectFields[].enabled",
  "collectFields[].useForQualification",
] as const;

export const WIZARD_APPOINTMENT_TYPE_CONTROL_PATHS = [
  "appointmentTypes[].id",
  "appointmentTypes[].name",
  "appointmentTypes[].durationMin",
  "appointmentTypes[].calendar",
  "appointmentTypes[].status",
  "appointmentTypes[].location",
  "appointmentTypes[].modality",
  "appointmentTypes[].description",
  "appointmentTypes[].bookingHours",
  "appointmentTypes[].minNotice",
  "appointmentTypes[].maxDaysAhead",
  "appointmentTypes[].requiredFields[]",
  "appointmentTypes[].bookingPermission",
  "appointmentTypes[].enabled",
] as const;

export const WIZARD_KNOWLEDGE_ITEM_CONTROL_PATHS = [
  "knowledgeItems[].id",
  "knowledgeItems[].label",
  "knowledgeItems[].summary",
  "knowledgeItems[].status",
  "knowledgeItems[].statusLabel",
] as const;

export const WIZARD_QUALIFICATION_RULE_CONTROL_PATHS = [
  "qualificationRules[].id",
  "qualificationRules[].fieldKey",
  "qualificationRules[].operator",
  "qualificationRules[].value",
  "qualificationRules[].resultStatus",
  "qualificationRules[].reasonCode",
  "qualificationRules[].reasonLabel",
] as const;

export const WIZARD_URGENCY_RULE_CONTROL_PATHS = [
  "urgencyRules[].id",
  "urgencyRules[].label",
  "urgencyRules[].fieldKey",
  "urgencyRules[].operator",
  "urgencyRules[].value",
  "urgencyRules[].severity",
  "urgencyRules[].action",
  "urgencyRules[].transferPlanId",
  "urgencyRules[].fallbackAction",
] as const;

export const WIZARD_TRANSFER_DEST_CONTROL_PATHS = [
  "transferDestinations[].id",
  "transferDestinations[].label",
  "transferDestinations[].phoneE164",
  "transferDestinations[].enabled",
] as const;

export const WIZARD_TRANSFER_PLAN_STEP_CONTROL_PATHS = [
  "transferPlanSteps[].order",
  "transferPlanSteps[].destinationId",
  "transferPlanSteps[].transferMode",
  "transferPlanSteps[].timeoutSeconds",
] as const;

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const AFTER_HOURS_WHEN_CLOSED_KEYS = [
  "allowLiveBooking",
  "allowCallbackRequest",
  "allowMessageTaking",
  "allowOnCallEscalation",
  "allowOfficeTransfer",
  "allowNormalTransferDestinations",
] as const;

const BOOKING_BEHAVIOR_KEYS = [
  "bookingBehavior.askPreferredDayFirst",
  "bookingBehavior.offerEarliestThree",
  "bookingBehavior.confirmBeforeBooking",
  "bookingBehavior.sendSmsAfterBooking",
  "bookingBehavior.askServiceFirst",
  "bookingBehavior.distinguishNewExisting",
] as const;

const CONVERSATION_BEHAVIOR_KEYS = [
  "conversationBehaviors.keepBrief",
  "conversationBehaviors.oneQuestionAtATime",
  "conversationBehaviors.confirmDetails",
  "conversationBehaviors.neverInventPricing",
  "conversationBehaviors.neverInventAvailability",
] as const;

function weeklyScheduleControlPaths(): string[] {
  const paths: string[] = [];
  for (const day of WEEKDAYS) {
    paths.push(`operatingMaturity.businessSchedule.weekly.${day}.closed`);
    paths.push(`operatingMaturity.businessSchedule.weekly.${day}.ranges[].start`);
    paths.push(`operatingMaturity.businessSchedule.weekly.${day}.ranges[].end`);
  }
  return paths;
}

function holidayControlPaths(): string[] {
  return [
    "operatingMaturity.businessSchedule.holidays[].id",
    "operatingMaturity.businessSchedule.holidays[].name",
    "operatingMaturity.businessSchedule.holidays[].startDate",
    "operatingMaturity.businessSchedule.holidays[].endDate",
    "operatingMaturity.businessSchedule.holidays[].closedAllDay",
  ];
}

function onCallEntryControlPaths(): string[] {
  return [
    "operatingMaturity.onCallSchedule.enabled",
    "operatingMaturity.onCallSchedule.entries[].id",
    "operatingMaturity.onCallSchedule.entries[].name",
    "operatingMaturity.onCallSchedule.entries[].dayOfWeek",
    "operatingMaturity.onCallSchedule.entries[].date",
    "operatingMaturity.onCallSchedule.entries[].startTime",
    "operatingMaturity.onCallSchedule.entries[].endTime",
    "operatingMaturity.onCallSchedule.entries[].destination.label",
    "operatingMaturity.onCallSchedule.entries[].destination.phoneE164",
    "operatingMaturity.onCallSchedule.entries[].priority",
    "operatingMaturity.onCallSchedule.entries[].enabled",
  ];
}

function callbackSlaControlPaths(): string[] {
  return [
    "operatingMaturity.callbackSla.normalTarget",
    "operatingMaturity.callbackSla.normalCustomMinutes",
    "operatingMaturity.callbackSla.urgentTarget",
    "operatingMaturity.callbackSla.urgentCustomMinutes",
  ];
}

/** Scalar / single-value wizard controls (Steps 1–8 + meta). */
export const WIZARD_SCALAR_CONTROL_PATHS: readonly string[] = [
  "answerWhen",
  "solutionName",
  "numberSource",
  "phoneNumberId",
  "phoneNumberE164",
  "outboundSmsMode",
  "outboundSmsPhoneNumberId",
  "outboundSmsE164",
  "ringBehavior",
  "ringTeamSeconds",
  "callRecording",
  "connectionGreeting",
  "connectionGreetingText",
  "connectionGreetingAudioUrl",
  "knowledgeSource",
  "websiteUrl",
  "linkedKnowledgeBaseId",
  "knowledgeBaseEnabled",
  "knowledgeBaseRevision",
  "businessName",
  "timezone",
  "operatingMaturity.businessSchedule.timezone",
  "operatingMaturity.afterHoursBehavior.useOperatingStateDuringCalls",
  ...AFTER_HOURS_WHEN_CLOSED_KEYS.map(
    (k) => `operatingMaturity.afterHoursBehavior.whenClosed.${k}`,
  ),
  "calendarProvider",
  "calendarConnected",
  "calendarEmail",
  "selectedAppointmentTypeId",
  "bookingStrategy",
  "bookingLinkUrl",
  "bookingLinkLabel",
  "calendlyEventTypeUri",
  "calendlyEventTypeName",
  "calendlyEventTypeDurationMin",
  "calendlyTimezone",
  ...BOOKING_BEHAVIOR_KEYS,
  "qualificationEnabled",
  "qualificationRequiredBeforePrimaryAction",
  "qualificationRevision",
  "qualificationSupportedZipCodes[]",
  "qualificationRulesMatchMode",
  "qualificationNotQualifiedFallback",
  "qualificationNeedsReviewFallback",
  "transferTriggers[]",
  "transferDestinationName",
  "transferDestinationPhone",
  "transferRingSeconds",
  "transferFallback",
  "warmTransfer",
  "detectVoicemailOnTransfer",
  "voiceV2HumanTransferEnabled",
  "allowCallerRequestedTransfer",
  "transferRouting",
  "defaultTransferPlanId",
  "urgencyEnabled",
  "callbackRequestsEnabled",
  "callbackUseAniByDefault",
  "callbackAskPreferredTime",
  "callbackConfirmNumber",
  "salesSolicitationEnabled",
  "salesSolicitationAction",
  "aiCallRecoveryEnabled",
  "aiCallRecoveryConsentMode",
  "aiCallRecoverySendingPhoneNumberId",
  "aiCallRecoveryContinueOverSms",
  "aiCallRecoveryDelaySeconds",
  "aiCallRecoverySendWhenCallbackCreated",
  "agentName",
  "role",
  "tone",
  "speakingStyle",
  "language",
  "speaksFirst",
  "openingGreeting",
  "voiceId",
  "voiceLabel",
  "speakingSpeed",
  "responsiveness",
  "interruptionSensitivity",
  "guardrails[]",
  "testScenario",
  "lastTestPassed",
  "activationMode",
  "scheduledAt",
  "longTermMemory",
  "crmEnabled",
  "qualityStudioLastRun",
  "agentId",
  "setupId",
  "outcomeSlug",
  "preset",
  "telnyxAssistantId",
];

/**
 * Every customer-editable leaf control in the Appointment Receptionist wizard.
 * Certification requires an exact manifest row per path (UNMAPPED = 0).
 */
export function buildWizardCustomerEditableControlPaths(): string[] {
  return [
    ...WIZARD_CAPABILITY_CONTROL_PATHS,
    ...WIZARD_SCALAR_CONTROL_PATHS,
    ...WIZARD_COLLECT_FIELD_CONTROL_PATHS,
    ...WIZARD_APPOINTMENT_TYPE_CONTROL_PATHS,
    ...WIZARD_KNOWLEDGE_ITEM_CONTROL_PATHS,
    ...WIZARD_QUALIFICATION_RULE_CONTROL_PATHS,
    ...WIZARD_URGENCY_RULE_CONTROL_PATHS,
    ...WIZARD_TRANSFER_DEST_CONTROL_PATHS,
    ...WIZARD_TRANSFER_PLAN_STEP_CONTROL_PATHS,
    ...weeklyScheduleControlPaths(),
    ...holidayControlPaths(),
    ...onCallEntryControlPaths(),
    ...callbackSlaControlPaths(),
    ...CONVERSATION_BEHAVIOR_KEYS,
  ];
}

export const WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS: readonly string[] =
  buildWizardCustomerEditableControlPaths();
