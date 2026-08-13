import type { VoiceAgentConfig } from "@/lib/voice/types";
import { createDefaultWizardState } from "./defaults";
import { normalizeWizardVoiceToElevenLabs } from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import { getReceptionistElevenLabsVoice } from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import type {
  AnswerTiming,
  CapabilityId,
  CollectFieldId,
  ReceptionistWizardState,
} from "./types";

const CAPABILITY_MAP: Record<string, CapabilityId> = {
  answer_questions: "answer_questions",
  take_messages: "take_messages",
  collect_info: "collect_info",
  book_appointments: "book_appointments",
  transfer_calls: "transfer_calls",
  send_text: "send_text",
};

const ANSWER_WHEN_REVERSE: Record<string, AnswerTiming> = {
  every_call: "every_call",
  after_hours: "after_hours",
  nobody_answers: "nobody_answers",
  overflow: "overflow",
};

export function wizardStateFromDraftConfig(
  draftConfig: unknown,
  agentId?: string,
  agentName?: string,
): ReceptionistWizardState {
  const base = createDefaultWizardState();
  const cfg = draftConfig as VoiceAgentConfig | null | undefined;
  if (!cfg) return { ...base, agentId, agentName: agentName || base.agentName };

  const wiz = (cfg.advanced as { receptionistWizard?: Partial<ReceptionistWizardState> } | undefined)
    ?.receptionistWizard;

  const greeting =
    (cfg.callHandling as { startupGreeting?: { text?: string } } | undefined)?.startupGreeting
      ?.text || base.greeting;

  const answerWhen = (cfg.inboundRules as { answerWhen?: string } | undefined)?.answerWhen;
  const answerTiming =
    answerWhen && ANSWER_WHEN_REVERSE[answerWhen]
      ? ANSWER_WHEN_REVERSE[answerWhen]
      : wiz?.answerTiming || base.answerTiming;

  const capabilities =
    wiz?.capabilities?.length
      ? wiz.capabilities
      : inferCapabilitiesFromConfig(cfg);

  const advancedVad = readRealtimeVad(cfg.advanced as Record<string, unknown> | undefined);

  return {
    ...base,
    agentId,
    agentName:
      cfg.identity?.displayName || agentName || wiz?.agentName || base.agentName,
    businessName: wiz?.businessName || extractBusinessFromRole(cfg.instructions?.role) || base.businessName,
    businessDescription:
      wiz?.businessDescription || cfg.instructions?.system || base.businessDescription,
    agentJobInstructions: wiz?.agentJobInstructions || base.agentJobInstructions,
    agentPersonalityNotes: wiz?.agentPersonalityNotes || base.agentPersonalityNotes,
    industry: wiz?.industry || base.industry,
    additionalInstructions: wiz?.additionalInstructions || base.additionalInstructions,
    businessHours: wiz?.businessHours || base.businessHours,
    serviceArea: wiz?.serviceArea || base.serviceArea,
    coreServices: wiz?.coreServices || base.coreServices,
    pricingNotes: wiz?.pricingNotes || base.pricingNotes,
    importantFacts: wiz?.importantFacts || base.importantFacts,
    businessAddress: wiz?.businessAddress || base.businessAddress,
    answerTiming,
    greeting,
    language: cfg.voiceLanguage?.primaryLanguage || base.language,
    timezone:
      wiz?.timezone ||
      String(cfg.dynamicVariables?.business_timezone || base.timezone),
    capabilities,
    collectFields: (wiz?.collectFields as CollectFieldId[]) || base.collectFields,
    voiceId: normalizeWizardVoiceToElevenLabs(
      cfg.voiceLanguage?.voiceId || wiz?.voiceId || base.voiceId,
    ),
    voiceLabel:
      wiz?.voiceLabel ||
      getReceptionistElevenLabsVoice(
        normalizeWizardVoiceToElevenLabs(cfg.voiceLanguage?.voiceId || wiz?.voiceId || base.voiceId),
      )?.label ||
      base.voiceLabel,
    voiceSpeed:
      typeof wiz?.voiceSpeed === "number" && Number.isFinite(wiz.voiceSpeed)
        ? wiz.voiceSpeed
        : typeof cfg.voiceLanguage?.speed === "number" && Number.isFinite(cfg.voiceLanguage.speed)
          ? cfg.voiceLanguage.speed
          : base.voiceSpeed,
    vadThreshold:
      typeof wiz?.vadThreshold === "number" && Number.isFinite(wiz.vadThreshold)
        ? wiz.vadThreshold
        : typeof advancedVad?.threshold === "number" && Number.isFinite(advancedVad.threshold)
          ? advancedVad.threshold
          : base.vadThreshold,
    vadSilenceMs:
      typeof wiz?.vadSilenceMs === "number" && Number.isFinite(wiz.vadSilenceMs)
        ? wiz.vadSilenceMs
        : typeof advancedVad?.silenceDurationMs === "number" &&
            Number.isFinite(advancedVad.silenceDurationMs)
          ? advancedVad.silenceDurationMs
          : base.vadSilenceMs,
    vadPrefixMs:
      typeof wiz?.vadPrefixMs === "number" && Number.isFinite(wiz.vadPrefixMs)
        ? wiz.vadPrefixMs
        : typeof advancedVad?.prefixPaddingMs === "number" &&
            Number.isFinite(advancedVad.prefixPaddingMs)
          ? advancedVad.prefixPaddingMs
          : base.vadPrefixMs,
  };
}

function readRealtimeVad(advanced: Record<string, unknown> | undefined) {
  const raw = advanced?.realtimeVad as
    | { threshold?: number; silenceDurationMs?: number; prefixPaddingMs?: number }
    | undefined;
  return raw;
}

function extractBusinessFromRole(role?: string): string {
  if (!role) return "";
  const m = role.match(/AI receptionist for (.+)/i);
  return m?.[1]?.trim() || "";
}

function inferCapabilitiesFromConfig(cfg: VoiceAgentConfig): CapabilityId[] {
  const caps: CapabilityId[] = ["answer_questions"];
  const tools = cfg.enabledBuiltinTools || [];
  if (tools.includes("take_message")) caps.push("take_messages");
  if (tools.some((t) => t.includes("book"))) caps.push("book_appointments");
  if (tools.some((t) => t.includes("transfer"))) caps.push("transfer_calls");
  if (tools.some((t) => t.includes("sms"))) caps.push("send_text");
  if (cfg.instructions?.requiredQuestions?.length) caps.push("collect_info");
  return caps;
}
