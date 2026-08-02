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
    voiceProvider?: string;
    speed?: number;
    pitch?: number;
    volume?: number;
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
  };
  transcription?: {
    enabled?: boolean;
    sttProvider?: string;
    sttModel?: string;
    keyterms?: string[];
    language?: string;
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
  toolIds?: string[];
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
    voiceId: "Telnyx.NaturalHD.andromeda",
    speed: 1,
    primaryLanguage: "en-US",
    silenceTimeoutMs: 8000,
    noiseSuppression: true,
  },
  model: {
    provider: "telnyx",
    modelId: "Qwen/Qwen3-235B-A22B",
    temperature: 0.4,
    maxTokens: 1024,
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
    transcription: { ...base.transcription, ...obj.transcription },
    model: { ...base.model, ...obj.model },
    multiParty: { ...base.multiParty, ...obj.multiParty },
    postCall: { ...base.postCall, ...obj.postCall },
  };
}

export function mergeVoiceConfig(
  prev: VoiceAgentConfig,
  patch: Partial<VoiceAgentConfig>,
): VoiceAgentConfig {
  return parseVoiceAgentConfig({ ...prev, ...patch });
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
