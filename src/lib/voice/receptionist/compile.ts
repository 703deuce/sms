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
  normalizeWizardVoiceToElevenLabs,
  RECEPTIONIST_TTS_MODEL,
  resolveConfiguredElevenLabsVoice,
} from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import { buildReceptionistBusinessContext } from "./build-business-context";
import { fieldManifestFromAdvancedRows } from "./field-manifest";

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
  if (caps.has("collect_info")) {
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
  const voiceMeta = input.voiceLabel?.trim();
  const wizAdvanced = input.advanced?.receptionistWizard as
    | { voiceSpeed?: number }
    | undefined;
  const voiceSpeedRaw = wizAdvanced?.voiceSpeed ?? input.advanced?.voiceSpeed;
  const voiceSpeed =
    typeof voiceSpeedRaw === "number" && Number.isFinite(voiceSpeedRaw)
      ? Math.min(2, Math.max(0.5, voiceSpeedRaw))
      : 1;

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
    enabledBuiltinTools,
    businessContext: "",
    realtimeModel: "gpt-realtime-2.1" as const,
    realtimeOutputMode: "elevenlabs" as const,
    ttsModel: RECEPTIONIST_TTS_MODEL as "eleven_flash_v2_5",
    voiceId: elevenLabsVoice,
    voiceLabel: voiceMeta || undefined,
    voiceSpeed,
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

  partialSnapshot.businessContext = buildReceptionistBusinessContext(partialSnapshot);

  return partialSnapshot;
}

/** Merge compiled snapshot into VoiceAgentConfig for draft/publish. */
export function applyCompiledToVoiceConfig(
  base: VoiceAgentConfig,
  snapshot: ReceptionistCompiledSnapshot,
): VoiceAgentConfig {
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
      speed: snapshot.voiceSpeed ?? base.voiceLanguage?.speed ?? 1,
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
      ...(base.advanced as object),
      livekitProfile: snapshot.livekitProfile,
      realtimeModel: snapshot.realtimeModel,
      realtimeOutputMode: snapshot.realtimeOutputMode,
      elevenLabsVoiceId: snapshot.voiceId,
      ttsModel: snapshot.ttsModel,
      [RECEPTIONIST_COMPILED_KEY]: snapshot,
      receptionistWizard: (base.advanced as Record<string, unknown> | undefined)?.receptionistWizard,
      receptionistAdvanced: (base.advanced as Record<string, unknown> | undefined)?.receptionistAdvanced,
    },
  };
}
