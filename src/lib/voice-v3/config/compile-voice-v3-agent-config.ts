import { createHash } from "node:crypto";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";
import { deriveBookingStrategyFromWizard } from "@/lib/voice-receptionist-wizard/booking-strategy";
import { tryNormalizeVoiceV3LiveBuiltInVoice } from "./voice-v3-live-built-in-voices";
import type { VoiceV3AgentConfig, VoiceV3ServiceConfig } from "./agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "./booking-agent-config";
import { compileBusinessHoursAmyDisplay } from "./business-hours-display";
import { businessHoursWindowFromWeeklySchedule } from "./business-hours-from-wizard";
import {
  DEFAULT_V3_BOOKING_STRATEGY,
  DEFAULT_V3_CALL_HANDLING,
  DEFAULT_V3_INTEGRATIONS,
  DEFAULT_V3_QUALIFICATION,
  DEFAULT_V3_RECOVERY,
} from "./default-nested-config";
import { defaultNestedFromFlat, mergeNestedConfig } from "./default-nested-config";
import {
  bookingRequiredIntakeKeys,
  compileWizardCollectFieldsToV3Intake,
} from "./wizard-collect-fields-v3";
import { resolveLivePromptControlsFromWizard } from "../prompts/live-prompt-controls";

export type VoiceV3ProviderConnections = {
  microsoftConnectionId?: string | null;
  microsoftCalendarIds?: string[];
  microsoftSmtp?: string | null;
};

function interpolateGreeting(
  template: string,
  businessName: string,
  agentName: string,
): string {
  return template
    .replaceAll("{{businessName}}", businessName || "our office")
    .replaceAll("{{agentName}}", agentName || "Amy");
}

function wizardServices(
  wizard: AppointmentReceptionistWizardState,
  slotStepMinutes: number,
): VoiceV3ServiceConfig[] {
  return (wizard.appointmentTypes || [])
    .filter((t) => t.enabled)
    .map((t) => ({
      id: t.id,
      name: t.name?.trim() || t.id,
      durationMinutes: t.durationMin > 0 ? t.durationMin : 30,
      slotStepMinutes,
      description: t.description?.trim() || undefined,
      enabled: true,
    }));
}

function resolvePrimaryService(
  wizard: AppointmentReceptionistWizardState,
  services: VoiceV3ServiceConfig[],
  fallback: VoiceV3ServiceConfig,
): VoiceV3ServiceConfig {
  if (services.length === 0) return fallback;
  const selectedId = wizard.selectedAppointmentTypeId?.trim();
  if (selectedId) {
    const hit = services.find((s) => s.id === selectedId);
    if (hit) return hit;
  }
  return services[0];
}

function capabilityFlagsFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV3AgentConfig["capabilities"] {
  const caps = new Set(wizard.capabilities || []);
  const book = caps.has("book_appointments");
  return {
    answerQuestions: caps.has("answer_questions"),
    collectIntake: true,
    checkAvailability: book,
    bookAppointments: book,
    findAppointments: book,
    rescheduleAppointments: caps.has("reschedule"),
    cancelAppointments: caps.has("cancel"),
    transferCalls: caps.has("transfer_calls"),
    sendSms:
      caps.has("send_sms_confirmations") || wizard.bookingBehavior?.sendSmsAfterBooking === true,
    takeMessages: caps.has("take_messages") || true,
    qualifyCallers: caps.has("qualify_callers") || wizard.qualificationEnabled === true,
  };
}

function hotContextFromWizard(wizard: AppointmentReceptionistWizardState): VoiceV3AgentConfig["business"] {
  const maturity = ensureWizardOperatingMaturity(wizard);
  const hoursItem = (wizard.knowledgeItems || []).find((k) => k.id === "hours")?.summary;
  const hoursCompile = compileBusinessHoursAmyDisplay({
    structuredSchedule: maturity.businessSchedule,
    hoursKnowledgeProse: hoursItem,
  });

  const knowledgeSummaries = (wizard.knowledgeItems || [])
    .filter((k) => k.status !== "rejected" && k.summary?.trim())
    .map((k) => ({ id: k.id, label: k.label, summary: k.summary }));

  const businessItem = knowledgeSummaries.find((k) => k.id === "business")?.summary;
  const servicesItem = knowledgeSummaries.find((k) => k.id === "services")?.summary;
  const pricing = knowledgeSummaries.find((k) => k.id === "pricing")?.summary;
  const policies = knowledgeSummaries.find((k) => k.id === "policies")?.summary;

  const enabledServices = (wizard.appointmentTypes || [])
    .filter((t) => t.enabled)
    .map((t) => t.name)
    .filter(Boolean);

  let companyDescription: string | undefined;
  let location: string | undefined;
  if (businessItem?.includes(" · ")) {
    const [biz, addr] = businessItem.split(" · ", 2);
    companyDescription = biz?.trim() || undefined;
    location = addr?.trim() || undefined;
  } else if (businessItem) {
    companyDescription = businessItem.trim();
  }

  return {
    companyDescription,
    location,
    hoursDisplay: hoursCompile.hoursDisplay,
    hoursStructuredMeta: {
      source: "operatingMaturity.businessSchedule.weekly",
      hoursProseConflictsWithStructured: hoursCompile.hoursProseConflictsWithStructured,
    },
    servicesSummary:
      servicesItem?.trim() ||
      (enabledServices.length ? enabledServices.join(", ") : undefined),
    pricingSummary: pricing?.trim() || undefined,
    policiesSummary: policies?.trim() || undefined,
    knowledgeItemSummaries: knowledgeSummaries.filter(
      (k) => !["business", "hours", "services", "pricing", "policies"].includes(k.id),
    ),
  };
}

function transferDestinationsFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV3AgentConfig["transferDestinations"] {
  const rows = wizard.transferDestinations?.filter((d) => d.enabled !== false) ?? [];
  if (rows.length > 0) {
    return rows.map((d) => ({
      id: d.id,
      label: d.label,
      phoneE164: d.phoneE164,
      enabled: d.enabled !== false,
    }));
  }
  const phone = wizard.transferDestinationPhone?.trim();
  if (phone && wizard.capabilities?.includes("transfer_calls")) {
    return [
      {
        id: "default_transfer",
        label: wizard.transferDestinationName?.trim() || "Team",
        phoneE164: phone,
        enabled: true,
      },
    ];
  }
  return [];
}

function configVersionHash(wizard: AppointmentReceptionistWizardState): string {
  return createHash("sha256")
    .update(JSON.stringify(wizard))
    .digest("hex")
    .slice(0, 16);
}

function bookingStrategyDetailFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV3AgentConfig["bookingStrategyDetail"] {
  const strategy = deriveBookingStrategyFromWizard(wizard);
  return {
    ...DEFAULT_V3_BOOKING_STRATEGY,
    strategy,
    executionStatus:
      strategy === "MICROSOFT_365" || strategy === "SEND_LINK"
        ? "ACTIVE_EXECUTION"
        : "CONFIGURED_NOT_IMPLEMENTED",
    bookingLinkUrl: wizard.bookingLinkUrl?.trim() || null,
    bookingLinkLabel: wizard.bookingLinkLabel?.trim() || null,
    sendLinkConsentRequired: wizard.bookingLinkSmsConsentRequired !== false,
    calendlyEventTypeUri: wizard.calendlyEventTypeUri?.trim() || null,
    calendlyEventTypeName: wizard.calendlyEventTypeName?.trim() || null,
    calendlyEventTypeDurationMin: wizard.calendlyEventTypeDurationMin ?? null,
    calendlyTimezone: wizard.calendlyTimezone?.trim() || null,
  };
}

function callHandlingFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV3AgentConfig["callHandling"] {
  return {
    ...DEFAULT_V3_CALL_HANDLING,
    transferTriggers: wizard.transferTriggers ?? [],
    transferRingSeconds: wizard.transferRingSeconds ?? DEFAULT_V3_CALL_HANDLING.transferRingSeconds,
    transferFallback: wizard.transferFallback ?? DEFAULT_V3_CALL_HANDLING.transferFallback,
    warmTransfer: wizard.warmTransfer ?? false,
    detectVoicemailOnTransfer: wizard.detectVoicemailOnTransfer ?? false,
    voiceV2HumanTransferEnabled: wizard.voiceV2HumanTransferEnabled === true,
    allowCallerRequestedTransfer: wizard.allowCallerRequestedTransfer !== false,
    transferRouting: wizard.transferRouting === "waterfall" ? "waterfall" : "single",
    defaultTransferPlanId: wizard.defaultTransferPlanId?.trim() || null,
    transferPlanSteps: wizard.transferPlanSteps ?? [],
    urgencyEnabled: wizard.urgencyEnabled === true,
    callbackRequestsEnabled: wizard.callbackRequestsEnabled !== false,
    callbackUseAniByDefault: wizard.callbackUseAniByDefault !== false,
    callbackAskPreferredTime: wizard.callbackAskPreferredTime !== false,
    callbackConfirmNumber: wizard.callbackConfirmNumber !== false,
    salesSolicitationEnabled: wizard.salesSolicitationEnabled === true,
    salesSolicitationAction: wizard.salesSolicitationAction ?? null,
  };
}

function qualificationFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV3AgentConfig["qualification"] {
  return {
    ...DEFAULT_V3_QUALIFICATION,
    enabled: wizard.qualificationEnabled === true,
    requiredBeforePrimaryAction: wizard.qualificationRequiredBeforePrimaryAction === true,
    revision: wizard.qualificationRevision ?? null,
    supportedZipCodes: wizard.qualificationSupportedZipCodes ?? [],
    rulesMatchMode: wizard.qualificationRulesMatchMode ?? null,
    notQualifiedFallback: wizard.qualificationNotQualifiedFallback ?? null,
    needsReviewFallback: wizard.qualificationNeedsReviewFallback ?? null,
    rules: wizard.qualificationRules ?? [],
  };
}

function recoveryFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV3AgentConfig["recovery"] {
  return {
    ...DEFAULT_V3_RECOVERY,
    aiCallRecoveryEnabled: wizard.aiCallRecoveryEnabled === true,
    consentMode: wizard.aiCallRecoveryConsentMode ?? null,
    sendingPhoneNumberId: wizard.aiCallRecoverySendingPhoneNumberId ?? null,
    continueOverSms: wizard.aiCallRecoveryContinueOverSms === true,
    delaySeconds: wizard.aiCallRecoveryDelaySeconds ?? null,
    sendWhenCallbackCreated: wizard.aiCallRecoverySendWhenCallbackCreated === true,
  };
}

function integrationsFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV3AgentConfig["integrations"] {
  return {
    ...DEFAULT_V3_INTEGRATIONS,
    crmEnabled: wizard.crmEnabled === true,
    longTermMemory: wizard.longTermMemory === true,
    calendarProvider: wizard.calendarProvider,
    calendarConnected: wizard.calendarConnected === true,
    calendarEmail: wizard.calendarEmail?.trim() || null,
  };
}

/**
 * Canonical Voice V3 compilation boundary: wizard snapshot → VoiceV3AgentConfig.
 */
export function compileVoiceV3AgentConfig(input: {
  wizard: AppointmentReceptionistWizardState;
  providerConnections?: VoiceV3ProviderConnections;
  envFallback?: VoiceV3AgentConfig;
  source?: VoiceV3AgentConfig["source"];
}): VoiceV3AgentConfig {
  const envFallback = input.envFallback ?? VOICE_V3_BOOKING_AGENT_CONFIG;
  const wizard = input.wizard;
  const slotStep = envFallback.service.slotStepMinutes;

  const services = wizardServices(wizard, slotStep);
  const service = resolvePrimaryService(wizard, services, envFallback.service);

  const intakeFields = compileWizardCollectFieldsToV3Intake(wizard.collectFields);
  const intake =
    intakeFields.length > 0 ? intakeFields : envFallback.intakeFields;

  const maturity = ensureWizardOperatingMaturity(wizard);
  const businessHours = businessHoursWindowFromWeeklySchedule(
    maturity.businessSchedule,
    envFallback.businessHours,
  );

  const timezone =
    wizard.timezone?.trim() ||
    maturity.businessSchedule?.timezone?.trim() ||
    envFallback.timezone;

  const businessName =
    wizard.businessName?.trim() || envFallback.businessName;
  const agentName = wizard.agentName?.trim() || envFallback.identity.agentName;

  const bookingStrategy = deriveBookingStrategyFromWizard(wizard);

  const connectionId =
    input.providerConnections?.microsoftConnectionId?.trim() ||
    envFallback.calendar?.connectionId ||
    "";

  const calendarIds =
    input.providerConnections?.microsoftCalendarIds?.length
      ? input.providerConnections.microsoftCalendarIds
      : envFallback.calendar?.calendarIds ?? ["primary"];

  const nested = defaultNestedFromFlat({
    businessName,
    timezone,
    service,
    agentName,
  });

  const base: VoiceV3AgentConfig = {
    ...envFallback,
    businessName,
    timezone,
    intake: envFallback.intake,
    intakeFields: intake,
    operationRequirements: {
      ...envFallback.operationRequirements,
      book_appointment: bookingRequiredIntakeKeys(intake),
    },
    service,
    businessHours,
    calendar:
      bookingStrategy === "MICROSOFT_365"
        ? {
            provider: "microsoft",
            connectionId,
            calendarIds,
            smtp:
              input.providerConnections?.microsoftSmtp ??
              envFallback.calendar?.smtp ??
              null,
          }
        : envFallback.calendar,
    ...nested,
    services: services.length ? services : [service],
    source: input.source ?? "wizard_published",
    configVersion: configVersionHash(wizard),
    callHandling: callHandlingFromWizard(wizard),
    qualification: qualificationFromWizard(wizard),
    recovery: recoveryFromWizard(wizard),
    integrations: integrationsFromWizard(wizard),
    bookingStrategyDetail: bookingStrategyDetailFromWizard(wizard),
  };

  return mergeNestedConfig(base, {
    identity: { agentName },
    capabilities: capabilityFlagsFromWizard(wizard),
    conversation: {
      role: wizard.role?.trim() || nested.conversation.role,
      tone: wizard.tone?.trim() || nested.conversation.tone,
      speakingStyle: wizard.speakingStyle?.trim() || nested.conversation.speakingStyle,
      language: wizard.language?.trim() || nested.conversation.language,
      speaksFirst: wizard.speaksFirst === "caller" ? "caller" : "ai",
      openingGreeting: interpolateGreeting(
        wizard.openingGreeting?.trim() || nested.conversation.openingGreeting,
        businessName,
        agentName,
      ),
      conversationBehaviors: wizard.conversationBehaviors ?? nested.conversation.conversationBehaviors,
      guardrails: wizard.guardrails ?? [],
      livePromptControls: resolveLivePromptControlsFromWizard({
        speakingPace: wizard.speakingPace,
        speakingSpeed: wizard.speakingSpeed,
        voiceAccent: wizard.voiceAccent,
        backchannelLevel: wizard.backchannelLevel,
        callerPausePatience: wizard.callerPausePatience,
        interruptionStyle: wizard.interruptionStyle,
      }),
    },
    business: hotContextFromWizard(wizard),
    scheduling: {
      bookingStrategy,
      primaryServiceId: service.id,
      services: services.length ? services : [service],
      bookingBehavior: wizard.bookingBehavior ?? nested.scheduling.bookingBehavior,
    },
    services: services.length ? services : [service],
    knowledge: {
      hotContext: hotContextFromWizard(wizard),
      retrieval: {
        enabled: wizard.knowledgeBaseEnabled === true,
        knowledgeBaseIds: wizard.linkedKnowledgeBaseId
          ? [wizard.linkedKnowledgeBaseId]
          : [],
        websiteUrl: wizard.websiteUrl?.trim() || null,
        documentSourceIds: [],
        revision: wizard.knowledgeBaseRevision ?? null,
      },
    },
    telephony: {
      phoneNumberId: wizard.phoneNumberId,
      phoneNumberE164: wizard.phoneNumberE164,
      answerWhen: wizard.answerWhen,
      numberSource: wizard.numberSource,
      ringBehavior: wizard.ringBehavior,
      ringTeamSeconds: wizard.ringTeamSeconds,
      outboundSmsMode: wizard.outboundSmsMode,
      outboundSmsPhoneNumberId: wizard.outboundSmsPhoneNumberId ?? null,
      outboundSmsE164: wizard.outboundSmsE164 ?? null,
      callRecording: wizard.callRecording ?? "off",
      connectionGreetingMode: wizard.connectionGreeting ?? "none",
      connectionGreetingText: wizard.connectionGreetingText,
      connectionGreetingAudioUrl: wizard.connectionGreetingAudioUrl,
      ...resolveTelephonyVoiceFromWizard(wizard, envFallback.telephony.liveVoiceId),
      voiceLabel: wizard.voiceLabel,
      speaksFirst: wizard.speaksFirst === "caller" ? "caller" : "ai",
      voiceSource: wizard.voiceSource ?? "builtin",
      openAiCustomVoiceId: wizard.openAiCustomVoiceId ?? null,
    },
    controlPlane: {
      solutionName: wizard.solutionName,
      outcomeSlug: wizard.outcomeSlug,
      preset: wizard.preset,
      testScenario: wizard.testScenario,
      activationMode: wizard.activationMode,
    },
    transferDestinations: transferDestinationsFromWizard(wizard),
  });
}

function safeLiveVoice(wizardVoiceId: string | undefined, fallback: string): string {
  const raw = wizardVoiceId?.trim() || fallback;
  const fromWizard = tryNormalizeVoiceV3LiveBuiltInVoice(raw);
  if (fromWizard) return fromWizard;
  const fromFallback = tryNormalizeVoiceV3LiveBuiltInVoice(fallback);
  if (fromFallback) return fromFallback;
  return "marin";
}

function resolveTelephonyVoiceFromWizard(
  wizard: AppointmentReceptionistWizardState,
  fallbackLiveVoiceId: string,
): Pick<
  VoiceV3AgentConfig["telephony"],
  "liveVoiceId" | "liveVoiceOutput"
> {
  const customId = wizard.openAiCustomVoiceId?.trim();
  if (wizard.voiceSource === "custom" && customId) {
    return {
      liveVoiceId: customId,
      liveVoiceOutput: { id: customId },
    };
  }
  const builtin = safeLiveVoice(wizard.voiceId, fallbackLiveVoiceId);
  return {
    liveVoiceId: builtin,
    liveVoiceOutput: builtin,
  };
}
