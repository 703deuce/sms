import { createHash } from "node:crypto";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";
import { deriveBookingStrategyFromWizard } from "@/lib/voice-receptionist-wizard/booking-strategy";
import { normalizeRealtimeNativeVoice } from "@/lib/voice/outbound/realtime-native-voices";
import type { VoiceV3AgentConfig, VoiceV3ServiceConfig } from "./agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "./booking-agent-config";
import {
  businessHoursWindowFromWeeklySchedule,
  formatWeeklyHoursForAmy,
} from "./business-hours-from-wizard";
import { defaultNestedFromFlat, mergeNestedConfig } from "./default-nested-config";
import {
  bookingRequiredIntakeKeys,
  compileWizardCollectFieldsToV3Intake,
} from "./wizard-collect-fields-v3";

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
  const scheduleHours = formatWeeklyHoursForAmy(maturity.businessSchedule);

  const knowledgeSummaries = (wizard.knowledgeItems || [])
    .filter((k) => k.status !== "rejected" && k.summary?.trim())
    .map((k) => ({ id: k.id, label: k.label, summary: k.summary }));

  const hoursItem = knowledgeSummaries.find((k) => k.id === "hours")?.summary;
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
    hoursDisplay: hoursItem?.trim() || scheduleHours || undefined,
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
    .update(JSON.stringify({ agentName: wizard.agentName, businessName: wizard.businessName }))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Canonical Voice V3 compilation boundary: wizard snapshot → VoiceV3AgentConfig.
 */
export function compileVoiceV3AgentConfig(input: {
  wizard: AppointmentReceptionistWizardState;
  providerConnections?: VoiceV3ProviderConnections;
  envFallback?: VoiceV3AgentConfig;
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
    source: "wizard_published",
    configVersion: configVersionHash(wizard),
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
      },
    },
    telephony: {
      phoneNumberId: wizard.phoneNumberId,
      phoneNumberE164: wizard.phoneNumberE164,
      callRecording: wizard.callRecording ?? "off",
      connectionGreetingMode: wizard.connectionGreeting ?? "none",
      liveVoiceId: safeLiveVoice(wizard.voiceId, envFallback.telephony.liveVoiceId),
      speaksFirst: wizard.speaksFirst === "caller" ? "caller" : "ai",
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
  try {
    return normalizeRealtimeNativeVoice(raw, "wizard.voiceId");
  } catch {
    try {
      return normalizeRealtimeNativeVoice(fallback, "fallback.liveVoiceId");
    } catch {
      return "marin";
    }
  }
}
