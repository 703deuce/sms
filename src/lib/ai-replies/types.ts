export const AI_REPLY_TYPES = ["conversational", "single_prompt"] as const;
export type AiReplyType = (typeof AI_REPLY_TYPES)[number];

export const AI_REPLY_TONES = ["professional", "friendly", "sales"] as const;
export type AiReplyTone = (typeof AI_REPLY_TONES)[number];

export const AI_REPLY_LENGTHS = ["short", "medium", "long"] as const;
export type AiReplyLength = (typeof AI_REPLY_LENGTHS)[number];

export type AiTriggerConfig = {
  mode?: "all_incoming" | "keywords" | "segment";
  keywords?: string[];
  segmentId?: string;
  segmentName?: string;
  schedule?: "always" | "outside_hours" | "business_hours";
};

export type AiKnowledgeConfig = {
  websites?: string[];
  textSnippets?: string[];
  qaPairs?: Array<{ question: string; answer: string }>;
};

export type AiLeadConfig = {
  enabled?: boolean;
  collectName?: boolean;
  collectEmail?: boolean;
  collectPhone?: boolean;
  collectCompany?: boolean;
  notifyEmail?: string;
};

export type AiHandoffConfig = {
  enabled?: boolean;
  keywords?: string[];
  notifyEmail?: string;
};

export type AiAdvancedConfig = {
  maxRepliesPerContact?: number;
  replyDelaySec?: number;
  temperature?: number;
  notifyAgentIfStuck?: boolean;
};

export type AiReplyRecord = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  replyType: AiReplyType;
  phoneNumberId: string | null;
  phoneNumberE164: string | null;
  status: "active" | "paused" | "draft";
  tone: AiReplyTone;
  responseLength: AiReplyLength;
  systemPrompt: string;
  trigger: AiTriggerConfig;
  knowledge: AiKnowledgeConfig;
  lead: AiLeadConfig;
  handoff: AiHandoffConfig;
  advanced: AiAdvancedConfig;
  messagesSent: number;
  contactsEngaged: number;
  conversions: number;
  handoffs: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiReplySessionRecord = {
  id: string;
  aiReplyId: string;
  conversationId: string;
  contactId: string;
  status: "ai_active" | "human" | "completed";
  messageCount: number;
  handedOff: boolean;
  aiReplyName?: string;
};

export const DEFAULT_AI_ADVANCED: AiAdvancedConfig = {
  maxRepliesPerContact: 10,
  replyDelaySec: 3,
  temperature: 0.5,
  notifyAgentIfStuck: true,
};

export function aiReplyTypeLabel(type: string): string {
  return type === "single_prompt" ? "Single Prompt" : "Conversational";
}

export function parseTriggerConfig(raw: unknown): AiTriggerConfig {
  if (!raw || typeof raw !== "object") return { mode: "all_incoming", schedule: "always" };
  const o = raw as Record<string, unknown>;
  return {
    mode: (o.mode as AiTriggerConfig["mode"]) || "all_incoming",
    keywords: Array.isArray(o.keywords) ? o.keywords.map(String) : [],
    segmentId: typeof o.segmentId === "string" ? o.segmentId : undefined,
    segmentName: typeof o.segmentName === "string" ? o.segmentName : undefined,
    schedule: (o.schedule as AiTriggerConfig["schedule"]) || "always",
  };
}

export function parseKnowledgeConfig(raw: unknown): AiKnowledgeConfig {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    websites: Array.isArray(o.websites) ? o.websites.map(String) : [],
    textSnippets: Array.isArray(o.textSnippets) ? o.textSnippets.map(String) : [],
    qaPairs: Array.isArray(o.qaPairs)
      ? o.qaPairs
          .map((q) => {
            if (!q || typeof q !== "object") return null;
            const row = q as Record<string, unknown>;
            return {
              question: String(row.question || ""),
              answer: String(row.answer || ""),
            };
          })
          .filter((q): q is { question: string; answer: string } => Boolean(q?.question))
      : [],
  };
}

export function parseLeadConfig(raw: unknown): AiLeadConfig {
  if (!raw || typeof raw !== "object") return { enabled: false };
  const o = raw as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    collectName: o.collectName !== false,
    collectEmail: Boolean(o.collectEmail),
    collectPhone: Boolean(o.collectPhone),
    collectCompany: Boolean(o.collectCompany),
    notifyEmail: typeof o.notifyEmail === "string" ? o.notifyEmail : undefined,
  };
}

export function parseHandoffConfig(raw: unknown): AiHandoffConfig {
  if (!raw || typeof raw !== "object") return { enabled: true, keywords: ["agent", "human", "help"] };
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled !== false,
    keywords: Array.isArray(o.keywords) ? o.keywords.map(String) : ["agent", "human", "help"],
    notifyEmail: typeof o.notifyEmail === "string" ? o.notifyEmail : undefined,
  };
}

export function parseAdvancedConfig(raw: unknown): AiAdvancedConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AI_ADVANCED };
  const o = raw as Record<string, unknown>;
  return {
    maxRepliesPerContact: Number(o.maxRepliesPerContact ?? DEFAULT_AI_ADVANCED.maxRepliesPerContact),
    replyDelaySec: Number(o.replyDelaySec ?? DEFAULT_AI_ADVANCED.replyDelaySec),
    temperature: Number(o.temperature ?? DEFAULT_AI_ADVANCED.temperature),
    notifyAgentIfStuck: o.notifyAgentIfStuck !== false,
  };
}

export function triggerSummary(trigger: AiTriggerConfig): string {
  if (trigger.mode === "keywords" && trigger.keywords?.length) {
    return `Keywords: ${trigger.keywords.join(", ")}`;
  }
  if (trigger.mode === "segment" && trigger.segmentName) {
    return `Segment: ${trigger.segmentName}`;
  }
  return "All incoming messages";
}
