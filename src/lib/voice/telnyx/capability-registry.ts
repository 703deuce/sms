/**
 * Telnyx AI Voice capability registry.
 * Status reflects full path wiring. Deferred items stay deferred.
 */

export type CapabilityWireStatus =
  | "live"
  | "wired"
  | "partial"
  | "client_only"
  | "db_only"
  | "deferred"
  | "unsupported";

export type CapabilityEntry = {
  id: string;
  label: string;
  phase: number;
  clientMethods: string[];
  telnyxPaths: string[];
  status: CapabilityWireStatus;
  notes?: string;
};

export const TELNYX_AI_CAPABILITY_REGISTRY: CapabilityEntry[] = [
  {
    id: "assistants.lifecycle",
    label: "Assistant CRUD / clone / import / enhance",
    phase: 4,
    clientMethods: [
      "listAssistants",
      "createAssistant",
      "updateAssistant",
      "deleteAssistant",
      "cloneAssistant",
      "importAssistants",
      "enhanceInstructions",
    ],
    telnyxPaths: ["/ai/assistants"],
    status: "live",
  },
  {
    id: "assistants.chat",
    label: "Web chat + SMS chat",
    phase: 22,
    clientMethods: ["chatAssistant", "smsChatAssistant"],
    telnyxPaths: ["/ai/assistants/{id}/chat", "/ai/assistants/{id}/chat/sms"],
    status: "live",
  },
  {
    id: "routing.inbound",
    label: "Inbound DID → AI start",
    phase: 5,
    clientMethods: ["startAiAssistant"],
    telnyxPaths: ["/calls/{id}/actions/ai_assistant_start"],
    status: "live",
  },
  {
    id: "dynamic_variables",
    label: "Dynamic variables + webhook",
    phase: 6,
    clientMethods: ["updateAssistant", "startAiAssistant"],
    telnyxPaths: ["dynamic_variables_webhook_url"],
    status: "live",
  },
  {
    id: "tools.native",
    label: "Native + Transovo tools",
    phase: 7,
    clientMethods: ["sendDtmf"],
    telnyxPaths: ["/api/telnyx/voice/tools"],
    status: "live",
  },
  {
    id: "transfers",
    label: "Human transfers + SIP REFER",
    phase: 8,
    clientMethods: ["transferCall"],
    telnyxPaths: ["/calls/{id}/actions/transfer", "/calls/{id}/actions/refer"],
    status: "live",
  },
  {
    id: "handoffs",
    label: "AI-to-AI handoff",
    phase: 9,
    clientMethods: ["updateAssistant"],
    telnyxPaths: ["tools.type=handoff"],
    status: "live",
    notes: "max_handoffs + hop analytics",
  },
  {
    id: "dtmf",
    label: "Send DTMF",
    phase: 10,
    clientMethods: ["sendDtmf"],
    telnyxPaths: ["/calls/{id}/actions/send_dtmf"],
    status: "live",
  },
  {
    id: "conversations",
    label: "Conversations + messages + retention",
    phase: 11,
    clientMethods: ["listConversations", "listConversationMessages", "deleteConversation"],
    telnyxPaths: ["/ai/conversations"],
    status: "live",
  },
  {
    id: "knowledge",
    label: "Knowledge bases / RAG",
    phase: 12,
    clientMethods: [],
    telnyxPaths: ["/ai/embeddings"],
    status: "live",
  },
  {
    id: "memory",
    label: "Memory / privacy",
    phase: 13,
    clientMethods: ["updateAssistant"],
    telnyxPaths: ["privacy_settings"],
    status: "live",
  },
  {
    id: "versions",
    label: "Versions + promote + compare",
    phase: 14,
    clientMethods: ["listVersions", "promoteVersion"],
    telnyxPaths: ["/ai/assistants/{id}/versions"],
    status: "live",
  },
  {
    id: "canary",
    label: "Canary deploys + metrics",
    phase: 15,
    clientMethods: ["createCanary", "deleteCanary"],
    telnyxPaths: ["/ai/assistants/{id}/canary-deploys"],
    status: "live",
  },
  {
    id: "tests",
    label: "Tests / suites / publish gate",
    phase: 16,
    clientMethods: ["createTest", "triggerSuiteRun"],
    telnyxPaths: ["/ai/assistants/tests"],
    status: "live",
  },
  {
    id: "scheduled_events",
    label: "Scheduled SMS (phone gated)",
    phase: 17,
    clientMethods: ["createScheduledEvent"],
    telnyxPaths: ["/ai/assistants/{id}/scheduled_events"],
    status: "live",
    notes: "phone_call requires outboundAiEnabled + consent",
  },
  {
    id: "insights",
    label: "Insights + webhook → CRM",
    phase: 18,
    clientMethods: ["createInsightGroup", "createInsight"],
    telnyxPaths: ["/ai/conversations/insight-groups"],
    status: "live",
  },
  {
    id: "mcp",
    label: "MCP + Transovo allowlist server",
    phase: 19,
    clientMethods: ["createMcpServer"],
    telnyxPaths: ["/ai/mcp_servers", "/api/public/voice/mcp"],
    status: "live",
    notes: "approved=false until review for arbitrary URLs",
  },
  {
    id: "integrations.telnyx",
    label: "Telnyx integration catalog",
    phase: 20,
    clientMethods: ["listIntegrations"],
    telnyxPaths: ["/ai/integrations"],
    status: "live",
  },
  {
    id: "multi_party",
    label: "Multi-participant AI modes",
    phase: 21,
    clientMethods: ["startAiAssistant"],
    telnyxPaths: ["conference overflow ai_assistant_start"],
    status: "live",
  },
  {
    id: "widget",
    label: "Web widget + session tokens",
    phase: 22,
    clientMethods: ["chatAssistant"],
    telnyxPaths: ["/api/public/voice/widget/*"],
    status: "live",
  },
  {
    id: "sms_cross_channel",
    label: "SMS assistant chat",
    phase: 23,
    clientMethods: ["smsChatAssistant"],
    telnyxPaths: ["/ai/assistants/{id}/chat/sms"],
    status: "live",
  },
  {
    id: "observability",
    label: "Observability + latency analytics",
    phase: 25,
    clientMethods: ["updateAssistant"],
    telnyxPaths: ["enabled_features"],
    status: "live",
    notes: "Langfuse customer login deferred",
  },
  {
    id: "usage_concurrency",
    label: "Usage + concurrency controls",
    phase: 26,
    clientMethods: [],
    telnyxPaths: [],
    status: "live",
  },
  {
    id: "outbound_campaigns",
    label: "Unrestricted outbound AI campaigns",
    phase: 17,
    clientMethods: ["createScheduledEvent"],
    telnyxPaths: ["/ai/assistants/{id}/scheduled_events"],
    status: "deferred",
  },
];

export function capabilityRegistrySnapshot() {
  const counts: Record<string, number> = {};
  for (const c of TELNYX_AI_CAPABILITY_REGISTRY) {
    counts[c.status] = (counts[c.status] || 0) + 1;
  }
  return { total: TELNYX_AI_CAPABILITY_REGISTRY.length, counts, items: TELNYX_AI_CAPABILITY_REGISTRY };
}
