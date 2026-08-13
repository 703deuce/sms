import type { VoiceAgentConfig } from "@/lib/voice/types";
import type {
  AgentFieldDefinition,
  AnswerWhenMode,
  ReceptionistCapability,
  ReceptionistCompiledSnapshot,
} from "./types";
import { RECEPTIONIST_COMPILED_KEY } from "./types";

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

/**
 * Convert customer-friendly draft into immutable runtime snapshot.
 * Phase 1: core fields + capabilities; Advanced sections use safe defaults.
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

  const fieldManifest = caps.has("collect_info")
    ? fieldManifestFromCollectIds(input.collectFields)
    : [];

  return {
    livekitProfile: "frontdesk_realtime",
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
    voiceId: input.voiceId,
    compiledAt: new Date().toISOString(),
    conversationBehavior: (input.advanced?.conversationBehavior as Record<string, unknown>) ?? {
      responseLength: "balanced",
      style: "professional",
      allowInterrupt: true,
    },
    bookingPolicy: input.advanced?.bookingPolicy as Record<string, unknown> | undefined,
    transferPolicy: input.advanced?.transferPolicy as Record<string, unknown> | undefined,
    knowledgePolicy: input.advanced?.knowledgePolicy as Record<string, unknown> | undefined,
    actionPermissions: input.advanced?.actionPermissions as Record<string, boolean> | undefined,
    fallbackPolicy: input.advanced?.fallbackPolicy as Record<string, unknown> | undefined,
    notifications: input.advanced?.notifications as Record<string, unknown> | undefined,
  };
}

/** Merge compiled snapshot into VoiceAgentConfig for draft/publish. */
export function applyCompiledToVoiceConfig(
  base: VoiceAgentConfig,
  snapshot: ReceptionistCompiledSnapshot,
): VoiceAgentConfig {
  const goals = snapshot.capabilities
    .map((c) => c.replace(/_/g, " "))
    .join(", ");

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
      tone: "friendly",
      style: "professional",
      responseLength: "balanced",
    },
    callHandling: {
      ...base.callHandling,
      startupGreeting: { enabled: true, text: snapshot.greeting },
    },
    voiceLanguage: {
      ...base.voiceLanguage,
      voiceId: snapshot.voiceId,
      primaryLanguage: snapshot.language,
    },
    inboundRules: {
      ...base.inboundRules,
      answerWhen: snapshot.answerWhen,
    },
    enabledBuiltinTools: snapshot.enabledBuiltinTools,
    advanced: {
      ...(base.advanced as object),
      livekitProfile: snapshot.livekitProfile,
      [RECEPTIONIST_COMPILED_KEY]: snapshot,
    },
  };
}
