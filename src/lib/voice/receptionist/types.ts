/**
 * Receptionist agent types — customer UI config and compiled runtime snapshot.
 * See docs/ai-receptionist-runtime-implementation.md
 */

export type AnswerWhenMode = "every_call" | "after_hours" | "nobody_answers" | "overflow";

export type ReceptionistCapability =
  | "answer_questions"
  | "take_messages"
  | "collect_info"
  | "book_appointments"
  | "transfer_calls"
  | "send_text";

/** Structured business facts compiled into the always-loaded BUSINESS section. */
export type ReceptionistBusinessProfile = {
  hours?: string;
  serviceArea?: string;
  coreServices?: string;
  pricingNotes?: string;
  importantFacts?: string;
  address?: string;
};

export type AgentFieldDefinition = {
  id: string;
  label: string;
  question: string;
  type: "text" | "phone" | "email" | "address" | "choice";
  required: boolean;
  askWhen?: "every_caller" | "new_callers" | "when_booking" | "service_inquiry";
  confirm?: boolean;
  validation?: string;
  skipIfKnown?: boolean;
};

/** Receptionist immutable runtime snapshot — stored on VoiceAgentVersion.config after compile. */
export type ReceptionistCompiledSnapshot = {
  livekitProfile: "frontdesk_realtime";
  businessName: string;
  agentDisplayName: string;
  businessDescription: string;
  greeting: string;
  language: string;
  timezone: string;
  answerWhen: AnswerWhenMode;
  capabilities: ReceptionistCapability[];
  fieldManifest: AgentFieldDefinition[];
  enabledBuiltinTools: string[];
  /** Customer job instructions — what the receptionist should do (always loaded). */
  agentJobInstructions: string;
  /** Optional personality notes compiled into AGENT (customer-owned). */
  agentPersonalityNotes?: string;
  /** Optional industry label from builder UI. */
  industry?: string;
  /** Optional freeform owner notes (Bland-style additional training). */
  additionalInstructions?: string;
  businessProfile: ReceptionistBusinessProfile;
  /** Full static prompt: constitution + agent + job + business + call configuration */
  compiledPrompt: string;
  /** Alias kept for retrieval guardrails and backward compatibility */
  businessContext: string;
  /** OpenAI Realtime intelligence model */
  realtimeModel: "gpt-realtime-2.1";
  /** Hybrid output: OpenAI text + ElevenLabs TTS */
  realtimeOutputMode: "elevenlabs";
  /** ElevenLabs TTS model — Flash v2.5 for all receptionist voices */
  ttsModel: "eleven_flash_v2_5";
  /** Advanced sections — safe defaults applied when omitted */
  conversationBehavior?: Record<string, unknown>;
  bookingPolicy?: Record<string, unknown>;
  transferPolicy?: Record<string, unknown>;
  knowledgePolicy?: Record<string, unknown>;
  actionPermissions?: Record<string, boolean>;
  fallbackPolicy?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
  intentRules?: Record<string, unknown>[];
  decisionRules?: Record<string, unknown>[];
  voiceId: string;
  /** ElevenLabs voice_id for TTS */
  voiceLabel?: string;
  /** OpenAI Realtime speech speed (0.5–2.0) — intelligence pacing when supported */
  voiceSpeed?: number;
  compiledAt: string;
};

export const RECEPTIONIST_COMPILED_KEY = "receptionistCompiled";
