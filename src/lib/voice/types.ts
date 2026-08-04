/**
 * Voice agent configuration types and defaults.
 */

export type VoiceAgentType =
  | "receptionist"
  | "lead_qualification"
  | "appointment_booking"
  | "customer_support"
  | "outbound_follow_up"
  | "sales"
  | "collections"
  | "survey"
  | "custom";

export type FormFieldKey = never; // avoid collision — voice uses VoiceSectionKey

export type VoiceSectionKey =
  | "identity"
  | "instructions"
  | "flow"
  | "conversationFlow"
  | "voiceLanguage"
  | "transcription"
  | "knowledge"
  | "tools"
  | "model"
  | "callHandling"
  | "inboundRules"
  | "outboundRules"
  | "transfers"
  | "voicemail"
  | "messaging"
  | "memory"
  | "mcp"
  | "insights"
  | "tests"
  | "versions"
  | "canary"
  | "scheduled"
  | "observability"
  | "postCall"
  | "compliance"
  | "security"
  | "platform"
  | "advanced";

export type VoiceAgentConfig = {
  identity?: {
    displayName?: string;
    businessLocation?: string;
    directions?: ("inbound" | "outbound")[];
  };
  instructions?: {
    system?: string;
    role?: string;
    goals?: string;
    requiredQuestions?: string[];
    prohibited?: string[];
    escalation?: string;
    uncertainty?: string;
    confirmation?: string;
    tone?: string;
    style?: string;
    pronunciation?: string;
    responseLength?: string;
    custom?: string;
    raw?: string;
    protectedGreeting?: boolean;
    fillerMessages?: string[];
  };
  conversationFlow?: {
    sections: Array<{
      id: string;
      type: string;
      label: string;
      enabled: boolean;
      config?: Record<string, unknown>;
    }>;
  };
  voiceLanguage?: {
    voiceId?: string;
    /** Provider voice id used if the primary voice fails to resolve. */
    fallbackVoiceId?: string;
    voiceProvider?: string;
    speed?: number;
    pitch?: number;
    volume?: number;
    /** Expressive / stability-style delivery when the voice model supports it. */
    expressiveMode?: boolean;
    /** Telnyx integration secret identifier for ElevenLabs (never the raw key). */
    elevenLabsApiKeyRef?: string;
    /** Include optional ElevenLabs tuning fields after basic voice succeeds. */
    elevenLabsTuning?: boolean;
    elevenLabsStability?: number;
    elevenLabsSimilarityBoost?: number;
    elevenLabsStyle?: number;
    elevenLabsSpeakerBoost?: boolean;
    /**
     * Assistant playback gain for PSTN clipping A/B (0, −3…−6 dB).
     * Does not change caller microphone gain.
     */
    outputGainDb?: 0 | -3 | -4 | -5 | -6;
    interruptionHandling?: string;
    bargeIn?: boolean;
    responsiveness?: string;
    silenceTimeoutMs?: number;
    endOfTurn?: string;
    endpointingMs?: number;
    noiseSuppression?: boolean;
    primaryLanguage?: string;
    additionalLanguages?: string[];
    autoLanguageDetection?: boolean;
    pronunciationDictionary?: Record<string, string>;
    /**
     * Optional experimental timing preset id. Not auto-applied to Telnyx.
     * Live timing uses endpointingMs / bargeIn / silenceTimeoutMs + provider defaults.
     */
    timingPreset?: string | null;
  };
  /**
   * Optional latency profile metadata.
   * `activeProfile` drives Telnyx Flux/legacy mapping.
   * `rollbackSnapshot` stores prior provider fields for one-click restore.
   */
  voiceTiming?: {
    presetId?: string | null;
    activeProfile?: string | null;
    experimental?: boolean;
    rollbackSnapshot?: Record<string, unknown>;
    diagnostics?: Record<string, unknown>;
  };
  transcription?: {
    enabled?: boolean;
    sttProvider?: string;
    sttModel?: string;
    keyterms?: string[];
    language?: string;
    /**
     * Provider-specific STT settings (e.g. Flux eot_threshold /
     * eager_eot_threshold). Only sent when the selected model supports them.
     */
    settings?: Record<string, unknown>;
  };
  model?: {
    provider?: string;
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    /** Custom OpenAI-compatible endpoint (server-side credentials only). */
    customBaseUrl?: string;
    customApiKeyRef?: string;
    maxToolCalls?: number;
  };
  callHandling?: Record<string, unknown>;
  inboundRules?: Record<string, unknown>;
  outboundRules?: Record<string, unknown>;
  transfers?: Record<string, unknown>;
  voicemail?: Record<string, unknown>;
  messaging?: Record<string, unknown>;
  multiParty?: {
    mode?: "assist" | "silent" | "listen_until_asked" | "exit_when_done";
    identifyAsAi?: boolean;
    maxParticipants?: number;
  };
  dynamicVariables?: Record<string, unknown>;
  postCall?: {
    scoringRules?: Array<{ field: string; points: number }>;
    extractionFields?: string[];
  };
  compliance?: Record<string, unknown>;
  advanced?: Record<string, unknown>;
  knowledgeBaseIds?: string[];
  /** Workspace VoiceTool row IDs linked to this agent. */
  toolIds?: string[];
  /**
   * Catalog keys (hangup, transfer, search_crm_contacts, …) explicitly
   * enabled for this agent. When omitted, template/safe defaults apply —
   * never the full catalog.
   */
  enabledBuiltinTools?: string[];
  /**
   * Visual flow bundle: routing graph + conversation graph + global rules.
   * Compiled on build/publish into instructions, tools, and VoiceRoutingRule rows.
   */
  flows?: {
    routing?: unknown;
    conversation?: unknown;
    globalRules?: unknown;
  };
};

export const DEFAULT_VOICE_CONFIG: VoiceAgentConfig = {
  identity: { directions: ["inbound", "outbound"] },
  instructions: {
    system:
      "You are a helpful AI voice assistant for the business. Be concise, professional, and never claim an action succeeded until confirmed by the system.",
    tone: "friendly",
    style: "conversational",
    responseLength: "medium",
    uncertainty: "If unsure, ask a clarifying question or offer to transfer to a human.",
    confirmation: "Confirm important details before completing bookings or transfers.",
  },
  conversationFlow: {
    sections: [
      { id: "greeting", type: "greeting", label: "Greeting", enabled: true },
      { id: "identify", type: "identify_caller", label: "Caller identification", enabled: true },
      { id: "intent", type: "intent", label: "Intent detection", enabled: true },
      { id: "qualify", type: "qualification", label: "Qualification", enabled: true },
      { id: "booking", type: "booking", label: "Booking", enabled: false },
      { id: "transfer", type: "transfer", label: "Transfer", enabled: true },
      { id: "message", type: "message_taking", label: "Message taking", enabled: true },
      { id: "sms", type: "sms_followup", label: "SMS follow-up", enabled: false },
      { id: "end", type: "ending", label: "End call", enabled: true },
    ],
  },
  voiceLanguage: {
    voiceProvider: "telnyx",
    voiceId: "ava-warm-us",
    speed: 1,
    primaryLanguage: "en-US",
    // Faster conversational turn-taking (target <1s after caller stops).
    silenceTimeoutMs: 2500,
    endpointingMs: 300,
    bargeIn: true,
    noiseSuppression: true,
    outputGainDb: -5,
  },
  model: {
    provider: "telnyx",
    modelId: "moonshotai/Kimi-K2.6",
    temperature: 0.4,
    maxTokens: 1024,
  },
  transcription: {
    enabled: true,
    sttProvider: "deepgram",
    sttModel: "deepgram/nova-3",
    language: "en",
  },
  callHandling: {
    greeting:
      "Thank you for calling. I'm the virtual assistant, and I can answer questions or take a message. How can I help you today?",
    closingStatement: "Thanks for calling. Goodbye.",
    startupGreeting: {
      enabled: true,
      mode: "ai",
      text: "Thank you for calling. Please hold for just a moment while I connect you with our AI assistant.",
      audioUrl: "",
      delayMs: "auto",
      handOffWhenReady: true,
    },
  },
  postCall: {
    scoringRules: [
      { field: "service_requested", points: 25 },
      { field: "in_service_area", points: 20 },
      { field: "timeline_provided", points: 15 },
      { field: "requested_estimate", points: 20 },
      { field: "budget_identified", points: 10 },
      { field: "appointment_booked", points: 10 },
    ],
  },
  // Explicit list preferred; when omitted at sync time, template/safe defaults apply.
  enabledBuiltinTools: [
    "hangup",
    "transfer",
    "handoff",
    "escalate_human",
    "send_dtmf",
    "end_call",
    "send_sms",
    "create_task",
    "take_structured_message",
    "mark_disposition",
    "save_caller_info",
    "update_contact_tags",
    "lookup_customer",
    "search_crm_contacts",
    "create_crm_note",
    "create_crm_task",
    "upsert_crm_contact",
  ],
};

export const AGENT_TYPE_LABELS: Record<VoiceAgentType, string> = {
  receptionist: "Receptionist",
  lead_qualification: "Lead qualification",
  appointment_booking: "Appointment booking",
  customer_support: "Customer support",
  outbound_follow_up: "Outbound follow-up",
  sales: "Sales agent",
  collections: "Collections / reminders",
  survey: "Survey agent",
  custom: "Custom",
};

export const VOICE_STATUS_MAP: Record<string, string> = {
  DRAFT: "Draft",
  TESTING: "Testing",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
  CONFIGURATION_ERROR: "Configuration error",
};

export function parseVoiceAgentConfig(raw: unknown): VoiceAgentConfig {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_VOICE_CONFIG);
  const base = structuredClone(DEFAULT_VOICE_CONFIG);
  const obj = raw as VoiceAgentConfig;
  return {
    ...base,
    ...obj,
    identity: { ...base.identity, ...obj.identity },
    instructions: { ...base.instructions, ...obj.instructions },
    conversationFlow: obj.conversationFlow ?? base.conversationFlow,
    voiceLanguage: { ...base.voiceLanguage, ...obj.voiceLanguage },
    voiceTiming: obj.voiceTiming
      ? { ...(base.voiceTiming || {}), ...obj.voiceTiming }
      : base.voiceTiming,
    transcription: {
      ...base.transcription,
      ...obj.transcription,
      settings:
        obj.transcription?.settings !== undefined
          ? obj.transcription.settings
          : base.transcription?.settings,
    },
    model: { ...base.model, ...obj.model },
    callHandling: {
      ...(base.callHandling || {}),
      ...(obj.callHandling || {}),
      startupGreeting: {
        ...((base.callHandling as { startupGreeting?: object } | undefined)
          ?.startupGreeting || {}),
        ...((obj.callHandling as { startupGreeting?: object } | undefined)
          ?.startupGreeting || {}),
      },
    },
    multiParty: { ...base.multiParty, ...obj.multiParty },
    postCall: { ...base.postCall, ...obj.postCall },
    enabledBuiltinTools: obj.enabledBuiltinTools ?? base.enabledBuiltinTools,
    flows: obj.flows ?? base.flows,
    toolIds: obj.toolIds ?? base.toolIds,
  };
}

export function mergeVoiceConfig(
  prev: VoiceAgentConfig,
  patch: Partial<VoiceAgentConfig>,
): VoiceAgentConfig {
  const prevHandling = (prev.callHandling || {}) as Record<string, unknown>;
  const patchHandling = (patch.callHandling || {}) as Record<string, unknown>;
  const mergedHandling =
    patch.callHandling || prev.callHandling
      ? {
          ...prevHandling,
          ...patchHandling,
          startupGreeting: {
            ...((prevHandling.startupGreeting as object) || {}),
            ...((patchHandling.startupGreeting as object) || {}),
          },
        }
      : undefined;
  return parseVoiceAgentConfig({
    ...prev,
    ...patch,
    ...(mergedHandling ? { callHandling: mergedHandling } : {}),
  });
}

export const DYNAMIC_VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

export function extractDynamicVariables(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(DYNAMIC_VARIABLE_PATTERN)) {
    found.add(m[1].trim());
  }
  return [...found];
}

export function renderDynamicVariables(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(DYNAMIC_VARIABLE_PATTERN, (_, key) => {
    const k = String(key).trim();
    return vars[k] ?? "";
  });
}
