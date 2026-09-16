import type {
  AppointmentReceptionistWizardState,
  WizardStepId,
} from "./types";

/** Fields owned by each wizard step — saves merge server draft with incoming for current step only. */
const STEP_OWNED_FIELDS: Record<
  WizardStepId,
  (keyof AppointmentReceptionistWizardState)[]
> = {
  goals: ["capabilities", "answerWhen", "solutionName", "preset", "outcomeSlug"],
  phone: [
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
  ],
  information: [
    "knowledgeSource",
    "websiteUrl",
    "linkedKnowledgeBaseId",
    "knowledgeBaseEnabled",
    "knowledgeBaseRevision",
    "knowledgeItems",
    "businessName",
    "agentName",
    "role",
    "tone",
    "speakingStyle",
    "language",
    "speaksFirst",
    "openingGreeting",
    "conversationBehaviors",
    "guardrails",
    "timezone",
    "longTermMemory",
    "crmEnabled",
  ],
  appointments: [
    "calendarProvider",
    "calendarConnected",
    "calendarEmail",
    "appointmentTypes",
    "selectedAppointmentTypeId",
    "bookingStrategy",
    "bookingLinkUrl",
    "bookingLinkLabel",
    "calendlyEventTypeUri",
    "calendlyEventTypeName",
    "calendlyEventTypeDurationMin",
    "calendlyTimezone",
    "bookingBehavior",
    "qualificationEnabled",
    "qualificationRequiredBeforePrimaryAction",
    "qualificationRevision",
    "qualificationSupportedZipCodes",
    "qualificationRulesMatchMode",
    "qualificationNotQualifiedFallback",
    "qualificationNeedsReviewFallback",
    "qualificationRules",
    "collectFields",
  ],
  "call-handling": [
    "transferTriggers",
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
    "transferDestinations",
    "transferPlanSteps",
    "urgencyEnabled",
    "urgencyRules",
    "callbackRequestsEnabled",
    "callbackUseAniByDefault",
    "callbackAskPreferredTime",
    "callbackConfirmNumber",
    "salesSolicitationEnabled",
    "salesSolicitationAction",
  ],
  voice: [
    "voiceId",
    "voiceLabel",
    "speakingSpeed",
    "responsiveness",
    "interruptionSensitivity",
  ],
  test: ["testScenario", "lastTestPassed"],
  activate: ["activationMode", "scheduledAt"],
};

const META_KEYS: (keyof AppointmentReceptionistWizardState)[] = [
  "agentId",
  "setupId",
  "outcomeSlug",
  "telnyxAssistantId",
];

/**
 * Prevent a save from one wizard page overwriting newer values saved from another page.
 * When stepId is omitted, incoming state wins entirely (legacy callers).
 */
export function mergeWizardStateForSave(
  server: Partial<AppointmentReceptionistWizardState> | null | undefined,
  incoming: AppointmentReceptionistWizardState,
  stepId?: WizardStepId | null,
): AppointmentReceptionistWizardState {
  if (!server || !stepId || !incoming.agentId) {
    return incoming;
  }
  const owned = new Set(STEP_OWNED_FIELDS[stepId]);
  const merged = { ...server, ...incoming } as AppointmentReceptionistWizardState;
  for (const key of Object.keys(server) as (keyof AppointmentReceptionistWizardState)[]) {
    if (META_KEYS.includes(key)) continue;
    if (!owned.has(key) && server[key] !== undefined) {
      merged[key] = server[key] as AppointmentReceptionistWizardState[typeof key];
    }
  }
  merged.agentId = incoming.agentId;
  if (incoming.setupId) merged.setupId = incoming.setupId;
  if (incoming.telnyxAssistantId !== undefined) {
    merged.telnyxAssistantId = incoming.telnyxAssistantId;
  }
  return merged;
}

export function wizardStepOwnedFields(stepId: WizardStepId) {
  return STEP_OWNED_FIELDS[stepId];
}
