import type { VoiceAgentConfig } from "@/lib/voice/types";
import type {
  AgentFieldDefinition,
  AnswerWhenMode,
  ReceptionistCapability,
  ReceptionistCompiledSnapshot,
} from "./types";
import { RECEPTIONIST_COMPILED_KEY } from "./types";
import type { ReceptionistAdvancedSettings } from "@/lib/receptionist-wizard/advanced-types";
import {
  getLiveKitAgentTemplateFromAdvanced,
  LIVEKIT_AGENT_TEMPLATE_KEY,
  normalizeAgentTemplateId,
} from "@/lib/voice/templates/agent-template-config";
import {
  normalizeWizardVoiceToElevenLabs,
  RECEPTIONIST_TTS_MODEL,
} from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import { resolveReceptionistElevenLabsTuning } from "@/lib/voice/elevenlabs/receptionist-voice-tuning";
import { normalizeWizardVoiceToRealtime } from "@/lib/voice/realtime-voice-picker";
import { buildReceptionistCompiledPrompt } from "./build-receptionist-compiled-prompt";
import { fieldManifestFromAdvancedRows } from "./field-manifest";
import { compileVoiceV2IntakeSchema } from "@/lib/voice-v2/intake/compile-schema";
import {
  buildVoiceV2LiveIntakeInstructions,
  useVoiceV2IntakeAuthority,
} from "@/lib/voice-v2/intake/live-intake-instructions";
import { isVoiceV2PstnOneAmyMode } from "@/lib/voice-v2/pstn-workflow-mode";

export type ReceptionistDraftInput = {
  agentName: string;
  businessName: string;
  businessDescription: string;
  greeting: string;
  language: string;
  timezone?: string;
  answerTiming: AnswerWhenMode;
  capabilities: ReceptionistCapability[];
  collectFields: string[];
  voiceId: string;
  voiceLabel?: string;
  agentJobInstructions?: string;
  agentPersonalityNotes?: string;
  industry?: string;
  additionalInstructions?: string;
  businessProfile?: import("./types").ReceptionistBusinessProfile;
  advanced?: Record<string, unknown>;
};

const CAPABILITY_TO_TOOLS: Partial<Record<ReceptionistCapability, string[]>> = {
  take_messages: ["take_message"],
  book_appointments: ["book_appointment"],
  transfer_calls: ["transfer_call"],
  send_text: ["send_sms"],
};

const DEFAULT_FIELDS: AgentFieldDefinition[] = [
  {
    id: "name",
    label: "Full name",
    question: "May I have your full name?",
    type: "text",
    required: true,
    askWhen: "every_caller",
  },
  {
    id: "phone",
    label: "Phone number",
    question: "What's the best phone number to reach you?",
    type: "phone",
    required: true,
    askWhen: "new_callers",
    confirm: true,
  },
  {
    id: "reason",
    label: "Reason for calling",
    question: "What can I help you with today?",
    type: "text",
    required: false,
    askWhen: "every_caller",
  },
];

function fieldManifestFromCollectIds(ids: string[]): AgentFieldDefinition[] {
  return DEFAULT_FIELDS.filter((f) => ids.includes(f.id));
}

function readAdvanced(input: ReceptionistDraftInput): ReceptionistAdvancedSettings | undefined {
  const raw = input.advanced?.receptionistAdvanced as ReceptionistAdvancedSettings | undefined;
  if (raw) return raw;
  return undefined;
}

function defaultConversationBehavior() {
  return {
    responseLength: "balanced" as const,
    style: "professional" as const,
    allowInterrupt: true,
    confirmImportantDetails: true,
    repeatWhenUncertain: true,
    avoidDuplicateQuestions: true,
    handleOutOfOrderAnswers: true,
    allowAcknowledgments: true,
    fillerSpeech: "natural" as const,
    silenceRepromptSec: 5 as const,
  };
}

/**
 * Convert customer-friendly draft into immutable runtime snapshot.
 */
export function compileReceptionistConfig(input: ReceptionistDraftInput): ReceptionistCompiledSnapshot {
  const caps = new Set(input.capabilities);
  const enabledBuiltinTools: string[] = [];
  for (const cap of caps) {
    const tools = CAPABILITY_TO_TOOLS[cap];
    if (tools) enabledBuiltinTools.push(...tools);
  }
  if (caps.has("answer_questions")) {
    enabledBuiltinTools.push("get_business_answer");
  }

  const advanced = readAdvanced(input);
  const actionPerms = advanced?.actionPermissions;

  if (actionPerms?.cancelAppointments && caps.has("book_appointments")) {
    enabledBuiltinTools.push("cancel_appointment");
  }
  if (actionPerms?.rescheduleAppointments && caps.has("book_appointments")) {
    enabledBuiltinTools.push("reschedule_appointment");
  }

  let fieldManifest: AgentFieldDefinition[] = [];
  if (caps.has("collect_info") || caps.has("book_appointments")) {
    if (advanced?.callerFields?.length) {
      fieldManifest = fieldManifestFromAdvancedRows(advanced.callerFields);
    } else {
      fieldManifest = fieldManifestFromCollectIds(input.collectFields);
    }
  }

  const conversationBehavior =
    advanced?.conversationBehavior ??
    (input.advanced?.conversationBehavior as Record<string, unknown>) ??
    defaultConversationBehavior();

  const transferPolicy = {
    ...(advanced?.transferPolicy as object),
    ...(input.advanced?.transferPolicy as object),
    destinationE164:
      advanced?.transferPolicy?.destinationE164?.trim() ||
      (input.advanced?.transferPolicy as { destinationE164?: string } | undefined)?.destinationE164?.trim() ||
      undefined,
    emergencyDestinationE164:
      advanced?.transferPolicy?.emergencyDestinationE164?.trim() || undefined,
  };

  const elevenLabsVoice = normalizeWizardVoiceToElevenLabs(input.voiceId);
  const realtimeVoice = normalizeWizardVoiceToRealtime(input.voiceId);
  const outputModeRaw = input.advanced?.realtimeOutputMode as string | undefined;
  const realtimeOutputMode =
    outputModeRaw === "elevenlabs" ? ("elevenlabs" as const) : ("native" as const);
  const voiceMeta = input.voiceLabel?.trim();
  const wiz = input.advanced?.receptionistWizard as
    | {
        voiceSpeed?: number;
        elevenLabsStability?: number;
        elevenLabsClarity?: number;
        elevenLabsStyle?: number;
        elevenLabsSpeakerBoost?: boolean;
        agentJobInstructions?: string;
        agentPersonalityNotes?: string;
        industry?: string;
        additionalInstructions?: string;
        businessHours?: string;
        serviceArea?: string;
        coreServices?: string;
        pricingNotes?: string;
        importantFacts?: string;
        businessAddress?: string;
      }
    | undefined;

  const voiceTuning = resolveReceptionistElevenLabsTuning({
    speed: wiz?.voiceSpeed ?? (input.advanced?.voiceSpeed as number | undefined),
    stability: wiz?.elevenLabsStability,
    similarityBoost: wiz?.elevenLabsClarity,
    style: wiz?.elevenLabsStyle,
    speakerBoost: wiz?.elevenLabsSpeakerBoost,
  });

  const businessProfile = {
    hours: wiz?.businessHours?.trim() || undefined,
    serviceArea: wiz?.serviceArea?.trim() || undefined,
    coreServices: wiz?.coreServices?.trim() || undefined,
    pricingNotes: wiz?.pricingNotes?.trim() || undefined,
    importantFacts: wiz?.importantFacts?.trim() || undefined,
    address: wiz?.businessAddress?.trim() || undefined,
  };

  const agentJobInstructions =
    input.agentJobInstructions?.trim() ||
    wiz?.agentJobInstructions?.trim() ||
    "";
  const agentPersonalityNotes =
    input.agentPersonalityNotes?.trim() ||
    wiz?.agentPersonalityNotes?.trim() ||
    undefined;
  const industry =
    input.industry?.trim() ||
    wiz?.industry?.trim() ||
    undefined;
  const additionalInstructions =
    input.additionalInstructions?.trim() ||
    wiz?.additionalInstructions?.trim() ||
    undefined;

  const voiceSpeed = voiceTuning.speed;

  const modelRaw = String(input.advanced?.realtimeModel || "gpt-realtime-2.1-mini").trim();
  const realtimeModel =
    modelRaw === "gpt-realtime-2.1" ? ("gpt-realtime-2.1" as const) : ("gpt-realtime-2.1-mini" as const);

  const voiceV2IntakeAuthority = useVoiceV2IntakeAuthority([...caps]);
  const voiceV2IntakeSchema = voiceV2IntakeAuthority
    ? compileVoiceV2IntakeSchema({
        advanced: {
          voiceV2Intake: advanced?.voiceV2Intake,
        },
      } as VoiceAgentConfig)
    : null;
  const voiceV2OneAmy = isVoiceV2PstnOneAmyMode({
    advanced: input.advanced,
  } as VoiceAgentConfig);
  const voiceV2IntakeInstructions = voiceV2IntakeSchema
    ? buildVoiceV2LiveIntakeInstructions(voiceV2IntakeSchema, { oneAmy: voiceV2OneAmy })
    : undefined;

  const partialSnapshot = {
    livekitProfile: "frontdesk_realtime" as const,
    businessName: input.businessName.trim(),
    agentDisplayName: input.agentName.trim() || "Amy",
    businessDescription: input.businessDescription.trim(),
    greeting: input.greeting.trim(),
    language: input.language || "en-US",
    timezone: input.timezone || "America/New_York",
    answerWhen: input.answerTiming,
    capabilities: [...caps],
    fieldManifest,
    voiceV2IntakeAuthority,
    voiceV2IntakeInstructions,
    voiceV2OneAmy,
    enabledBuiltinTools,
    agentJobInstructions,
    agentPersonalityNotes,
    industry,
    additionalInstructions,
    businessProfile,
    compiledPrompt: "",
    businessContext: "",
    realtimeModel,
    realtimeOutputMode,
    ttsModel: RECEPTIONIST_TTS_MODEL as "eleven_flash_v2_5",
    voiceId: realtimeOutputMode === "elevenlabs" ? elevenLabsVoice : realtimeVoice,
    voiceLabel: voiceMeta || undefined,
    voiceSpeed,
    elevenLabsStability: voiceTuning.stability,
    elevenLabsSimilarityBoost: voiceTuning.similarityBoost,
    elevenLabsStyle: voiceTuning.style,
    elevenLabsSpeakerBoost: voiceTuning.speakerBoost,
    compiledAt: new Date().toISOString(),
    conversationBehavior,
    bookingPolicy: advanced?.bookingPolicy ?? (input.advanced?.bookingPolicy as Record<string, unknown>),
    transferPolicy,
    knowledgePolicy: advanced?.knowledgePolicy ?? (input.advanced?.knowledgePolicy as Record<string, unknown>),
    actionPermissions: advanced?.actionPermissions ?? (input.advanced?.actionPermissions as Record<string, boolean>),
    fallbackPolicy: advanced?.fallbackPolicy ?? (input.advanced?.fallbackPolicy as Record<string, unknown>),
    notifications: advanced?.notifications ?? (input.advanced?.notifications as Record<string, unknown>),
    intentRules: advanced?.intents?.filter((i) => i.enabled) ?? [],
    decisionRules: advanced?.decisionRules ?? [],
  };

  partialSnapshot.compiledPrompt = buildReceptionistCompiledPrompt(partialSnapshot);
  partialSnapshot.businessContext = partialSnapshot.compiledPrompt;

  return partialSnapshot;
}

/** Merge compiled snapshot into VoiceAgentConfig for draft/publish. */
export function applyCompiledToVoiceConfig(
  base: VoiceAgentConfig,
  snapshot: ReceptionistCompiledSnapshot,
  mergeAdvanced?: Record<string, unknown>,
): VoiceAgentConfig {
  const mergedAdvanced = {
    ...(base.advanced as Record<string, unknown> | undefined),
    ...(mergeAdvanced || {}),
  } as Record<string, unknown> | undefined;
  const livekitAgentTemplate = normalizeAgentTemplateId(
    getLiveKitAgentTemplateFromAdvanced(mergedAdvanced),
  );
  const goals = snapshot.capabilities
    .map((c) => c.replace(/_/g, " "))
    .join(", ");

  const conv = snapshot.conversationBehavior as {
    responseLength?: string;
    style?: string;
  } | undefined;
  const responseLength = conv?.responseLength || "balanced";
  const style = conv?.style || "professional";

  return {
    ...base,
    identity: {
      ...base.identity,
      displayName: snapshot.agentDisplayName,
      directions: ["inbound"],
    },
    instructions: {
      ...base.instructions,
      raw: snapshot.compiledPrompt,
      role: `AI receptionist for ${snapshot.businessName}`,
      system: snapshot.businessDescription,
      goals,
      requiredQuestions: snapshot.fieldManifest.map((f) => f.label),
      tone: style === "casual" ? "casual" : style === "friendly" ? "friendly" : "professional",
      style,
      responseLength,
    },
    callHandling: {
      ...base.callHandling,
      startupGreeting: { enabled: true, text: snapshot.greeting },
    },
    voiceLanguage: {
      ...base.voiceLanguage,
      voiceId: snapshot.voiceId,
      primaryLanguage: snapshot.language,
      speed: snapshot.voiceSpeed ?? base.voiceLanguage?.speed ?? 1.08,
      elevenLabsTuning: true,
      elevenLabsStability: snapshot.elevenLabsStability,
      elevenLabsSimilarityBoost: snapshot.elevenLabsSimilarityBoost,
      elevenLabsStyle: snapshot.elevenLabsStyle,
      elevenLabsSpeakerBoost: snapshot.elevenLabsSpeakerBoost,
    },
    inboundRules: {
      ...base.inboundRules,
      answerWhen: snapshot.answerWhen,
    },
    enabledBuiltinTools: snapshot.enabledBuiltinTools,
    dynamicVariables: {
      ...(base.dynamicVariables as object),
      business_name: snapshot.businessName,
      business_timezone: snapshot.timezone,
    },
    advanced: {
      ...(mergedAdvanced as object),
      voiceV2PstnLiveBooking:
        mergedAdvanced?.bookingStrategy === "MICROSOFT_365" ||
        (mergedAdvanced?.voiceV2PstnLiveBooking === true &&
          mergedAdvanced?.bookingStrategy !== "REQUEST_ONLY" &&
          mergedAdvanced?.bookingStrategy !== "NONE"),
      bookingStrategy: mergedAdvanced?.bookingStrategy,
      conversationWorkflowMode: mergedAdvanced?.conversationWorkflowMode ?? true,
      livekitProfile: snapshot.livekitProfile,
      realtimeModel: snapshot.realtimeModel,
      realtimeOutputMode: snapshot.realtimeOutputMode,
      realtimeVoice:
        snapshot.realtimeOutputMode === "native" ? snapshot.voiceId : undefined,
      realtimeReasoningEffort: "low",
      elevenLabsVoiceId:
        snapshot.realtimeOutputMode === "elevenlabs" ? snapshot.voiceId : undefined,
      ttsModel: snapshot.ttsModel,
      [RECEPTIONIST_COMPILED_KEY]: snapshot,
      receptionistWizard: mergedAdvanced?.receptionistWizard,
      receptionistAdvanced: mergedAdvanced?.receptionistAdvanced,
      [LIVEKIT_AGENT_TEMPLATE_KEY]: livekitAgentTemplate,
    },
  };
}
