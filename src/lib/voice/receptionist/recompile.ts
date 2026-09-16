import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type { AnswerWhenMode, ReceptionistCapability } from "./types";
import {
  RECEPTIONIST_ADVANCED_KEY,
  type ReceptionistAdvancedSettings,
} from "@/lib/receptionist-wizard/advanced-types";
import type { ReceptionistWizardState } from "@/lib/receptionist-wizard/types";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
  type ReceptionistDraftInput,
} from "./compile";
import { getReceptionistCompiledFromAdvanced } from "./runtime";
import {
  getLiveKitAgentTemplateFromAdvanced,
  LIVEKIT_AGENT_TEMPLATE_KEY,
  normalizeAgentTemplateId,
} from "@/lib/voice/templates/agent-template-config";

function mapAnswerWhen(mode: AppointmentReceptionistWizardState["answerWhen"]): AnswerWhenMode {
  switch (mode) {
    case "after_hours":
      return "after_hours";
    case "nobody_answers":
      return "nobody_answers";
    case "line_busy":
      return "overflow";
    default:
      return "every_call";
  }
}

function appointmentWizardToDraftInput(
  state: AppointmentReceptionistWizardState,
  config: VoiceAgentConfig,
  advanced: Record<string, unknown>,
): ReceptionistDraftInput {
  const caps = new Set<ReceptionistCapability>(["answer_questions"]);
  if (
    state.capabilities.includes("book_appointments") ||
    state.calendarConnected ||
    state.capabilities.includes("reschedule")
  ) {
    caps.add("book_appointments");
  }
  if (state.capabilities.includes("take_messages")) caps.add("take_messages");
  if (state.capabilities.includes("transfer_calls")) caps.add("transfer_calls");
  if (state.capabilities.includes("send_sms_confirmations")) caps.add("send_text");

  const profile = [
    state.websiteUrl ? `Website: ${state.websiteUrl}` : "",
    state.knowledgeItems?.map((k) => k.summary).filter(Boolean).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    agentName: state.agentName || config.identity?.displayName || "Amy",
    businessName: state.businessName || "",
    businessDescription: profile || config.instructions?.system || "",
    greeting: state.openingGreeting || config.callHandling?.startupGreeting?.text || "",
    language: state.language || config.voiceLanguage?.primaryLanguage || "en-US",
    timezone: state.timezone || String(config.dynamicVariables?.business_timezone || "America/New_York"),
    answerTiming: mapAnswerWhen(state.answerWhen),
    capabilities: [...caps],
    collectFields: (state.collectFields || []).filter((f) => f.enabled).map((f) => f.id),
    voiceId: state.voiceId || config.voiceLanguage?.voiceId || "marin",
    voiceLabel: state.voiceLabel,
    advanced: {
      ...advanced,
      appointmentReceptionistWizard: state,
      voiceV2Intake: advanced.voiceV2Intake,
      voiceV2PstnLiveBooking: advanced.voiceV2PstnLiveBooking,
      conversationWorkflowMode: advanced.conversationWorkflowMode ?? true,
    },
  };
}

/** Re-compile receptionist draft from wizard snapshot stored on advanced. */
export function recompileReceptionistFromDraft(config: VoiceAgentConfig): VoiceAgentConfig {
  const advanced = config.advanced as Record<string, unknown> | undefined;
  const wizard = advanced?.receptionistWizard as Partial<ReceptionistWizardState> | undefined;
  const appointmentWizard = advanced?.appointmentReceptionistWizard as
    | AppointmentReceptionistWizardState
    | undefined;
  if (!wizard && appointmentWizard) {
    const draftInput = appointmentWizardToDraftInput(appointmentWizard, config, advanced || {});
    const snapshot = compileReceptionistConfig(draftInput);
    return applyCompiledToVoiceConfig(config, snapshot, {
      ...(advanced || {}),
      appointmentReceptionistWizard: appointmentWizard,
    });
  }
  if (!wizard) {
    const existing = getReceptionistCompiledFromAdvanced(advanced);
    return existing ? config : config;
  }

  const storedAdvanced = advanced?.[RECEPTIONIST_ADVANCED_KEY] as
    | ReceptionistAdvancedSettings
    | undefined;

  const draftInput: ReceptionistDraftInput = {
    agentName: wizard.agentName || config.identity?.displayName || "Amy",
    businessName: wizard.businessName || "",
    businessDescription: wizard.businessDescription || config.instructions?.system || "",
    greeting:
      wizard.greeting ||
      (config.callHandling as { startupGreeting?: { text?: string } } | undefined)?.startupGreeting
        ?.text ||
      "",
    language: wizard.language || config.voiceLanguage?.primaryLanguage || "en-US",
    timezone:
      (wizard as { timezone?: string }).timezone ||
      String(config.dynamicVariables?.business_timezone || "America/New_York"),
    answerTiming: wizard.answerTiming || "every_call",
    capabilities: wizard.capabilities || [],
    collectFields: wizard.collectFields || [],
    voiceId: wizard.voiceId || config.voiceLanguage?.voiceId || "marin",
    voiceLabel: wizard.voiceLabel,
    advanced: {
      conversationBehavior: storedAdvanced?.conversationBehavior ?? advanced?.conversationBehavior,
      bookingPolicy: storedAdvanced?.bookingPolicy ?? advanced?.bookingPolicy,
      transferPolicy: storedAdvanced?.transferPolicy ?? advanced?.transferPolicy,
      knowledgePolicy: storedAdvanced?.knowledgePolicy ?? advanced?.knowledgePolicy,
      actionPermissions: storedAdvanced?.actionPermissions ?? advanced?.actionPermissions,
      fallbackPolicy: storedAdvanced?.fallbackPolicy ?? advanced?.fallbackPolicy,
      notifications: storedAdvanced?.notifications ?? advanced?.notifications,
      realtimeOutputMode: advanced?.realtimeOutputMode,
      realtimeModel: advanced?.realtimeModel,
      realtimeReasoningEffort: advanced?.realtimeReasoningEffort,
      realtimeVoice: advanced?.realtimeVoice,
      [RECEPTIONIST_ADVANCED_KEY]: storedAdvanced ?? advanced?.[RECEPTIONIST_ADVANCED_KEY],
      receptionistWizard: wizard,
    },
  };

  const snapshot = compileReceptionistConfig(draftInput);
  const merged = applyCompiledToVoiceConfig(config, snapshot, {
    receptionistWizard: wizard,
    [RECEPTIONIST_ADVANCED_KEY]: storedAdvanced ?? advanced?.[RECEPTIONIST_ADVANCED_KEY],
    [LIVEKIT_AGENT_TEMPLATE_KEY]: normalizeAgentTemplateId(
      getLiveKitAgentTemplateFromAdvanced(advanced),
    ),
  });
  const livekitAgentTemplate = normalizeAgentTemplateId(
    getLiveKitAgentTemplateFromAdvanced({
      ...(merged.advanced as Record<string, unknown> | undefined),
      receptionistWizard: wizard,
      [LIVEKIT_AGENT_TEMPLATE_KEY]: advanced?.[LIVEKIT_AGENT_TEMPLATE_KEY],
    }),
  );

  return {
    ...merged,
    advanced: {
      ...(merged.advanced as object),
      [LIVEKIT_AGENT_TEMPLATE_KEY]: livekitAgentTemplate,
      [RECEPTIONIST_ADVANCED_KEY]: storedAdvanced ?? advanced?.[RECEPTIONIST_ADVANCED_KEY],
      receptionistWizard: wizard,
      conversationBehavior: storedAdvanced?.conversationBehavior ?? advanced?.conversationBehavior,
      bookingPolicy: storedAdvanced?.bookingPolicy ?? advanced?.bookingPolicy,
      transferPolicy: storedAdvanced?.transferPolicy ?? advanced?.transferPolicy,
      knowledgePolicy: storedAdvanced?.knowledgePolicy ?? advanced?.knowledgePolicy,
      actionPermissions: storedAdvanced?.actionPermissions ?? advanced?.actionPermissions,
      fallbackPolicy: storedAdvanced?.fallbackPolicy ?? advanced?.fallbackPolicy,
      notifications: storedAdvanced?.notifications ?? advanced?.notifications,
      realtimeOutputMode: advanced?.realtimeOutputMode ?? (merged.advanced as Record<string, unknown>)?.realtimeOutputMode,
      realtimeModel: advanced?.realtimeModel ?? (merged.advanced as Record<string, unknown>)?.realtimeModel,
      realtimeReasoningEffort:
        advanced?.realtimeReasoningEffort ??
        (merged.advanced as Record<string, unknown>)?.realtimeReasoningEffort,
      realtimeVoice: advanced?.realtimeVoice ?? (merged.advanced as Record<string, unknown>)?.realtimeVoice,
    },
  };
}
