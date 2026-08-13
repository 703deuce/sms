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

/** Immutable runtime snapshot — stored on VoiceAgentVersion.config after compile. */
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
  /** OpenAI Realtime speech speed (0.5–2.0). */
  voiceSpeed?: number;
  compiledAt: string;
};

export const RECEPTIONIST_COMPILED_KEY = "receptionistCompiled";
