/**
 * Telnyx AI Voice capability registry.
 * Each entry maps a product capability to the ai-client method(s) and wiring status.
 * Status is updated as Transovo connects DB → service → API → webhook → UI → tests.
 */

export type CapabilityWireStatus =
  | "live"
  | "wired"
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
      "getAssistant",
      "updateAssistant",
      "deleteAssistant",
      "cloneAssistant",
      "importAssistants",
      "enhanceInstructions",
    ],
    telnyxPaths: ["/ai/assistants", "/ai/assistants/{id}", "/ai/assistants/{id}/clone"],
    status: "live",
  },
  {
    id: "assistants.chat",
    label: "Web chat + SMS chat preview",
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
    telnyxPaths: ["assistant.dynamic_variables", "dynamic_variables_webhook_url"],
    status: "live",
  },
  {
    id: "tools.native",
    label: "Native tools (webhook, hangup, transfer, handoff, DTMF)",
    phase: 7,
    clientMethods: ["sendDtmf", "testAssistantTool", "deleteAssistantTool"],
    telnyxPaths: ["/calls/{id}/actions/send_dtmf", "/ai/assistants/{id}/tools/{toolId}"],
    status: "live",
  },
  {
    id: "transfers",
    label: "Human transfer destinations",
    phase: 8,
    clientMethods: ["transferCall"],
    telnyxPaths: ["/calls/{id}/actions/transfer"],
    status: "live",
  },
  {
    id: "handoffs",
    label: "AI-to-AI handoff",
    phase: 9,
    clientMethods: ["updateAssistant"],
    telnyxPaths: ["tools.type=handoff"],
    status: "live",
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
    label: "Conversations + messages",
    phase: 11,
    clientMethods: [
      "listConversations",
      "getConversation",
      "listConversationMessages",
      "addConversationMessage",
    ],
    telnyxPaths: ["/ai/conversations", "/ai/conversations/{id}/messages"],
    status: "live",
  },
  {
    id: "knowledge",
    label: "Knowledge bases / RAG",
    phase: 12,
    clientMethods: [],
    telnyxPaths: ["/ai/embeddings"],
    status: "live",
    notes: "Existing rag.ts + storage.ts",
  },
  {
    id: "memory",
    label: "Memory / privacy settings",
    phase: 13,
    clientMethods: ["updateAssistant"],
    telnyxPaths: ["privacy_settings"],
    status: "live",
  },
  {
    id: "versions",
    label: "Assistant versions + promote",
    phase: 14,
    clientMethods: ["listVersions", "getVersion", "updateVersion", "deleteVersion", "promoteVersion"],
    telnyxPaths: ["/ai/assistants/{id}/versions"],
    status: "live",
  },
  {
    id: "canary",
    label: "Canary deploys",
    phase: 15,
    clientMethods: ["getCanary", "createCanary", "updateCanary", "deleteCanary"],
    telnyxPaths: ["/ai/assistants/{id}/canary-deploys"],
    status: "live",
  },
  {
    id: "tests",
    label: "Assistant tests + suites + runs",
    phase: 16,
    clientMethods: [
      "listTests",
      "createTest",
      "triggerTestRun",
      "listTestSuites",
      "triggerSuiteRun",
    ],
    telnyxPaths: ["/ai/assistants/tests", "/ai/assistants/tests/test-suites"],
    status: "live",
  },
  {
    id: "scheduled_events",
    label: "Scheduled events (SMS default; outbound AI gated)",
    phase: 17,
    clientMethods: [
      "listScheduledEvents",
      "createScheduledEvent",
      "deleteScheduledEvent",
    ],
    telnyxPaths: ["/ai/assistants/{id}/scheduled_events"],
    status: "live",
    notes: "phone_call channel requires outboundAiEnabled",
  },
  {
    id: "insights",
    label: "Insights + insight groups",
    phase: 18,
    clientMethods: [
      "listInsights",
      "createInsight",
      "listInsightGroups",
      "createInsightGroup",
      "assignInsightToGroup",
    ],
    telnyxPaths: ["/ai/conversations/insights", "/ai/conversations/insight-groups"],
    status: "live",
    notes: "Webhook: /api/telnyx/voice/insights",
  },
  {
    id: "mcp",
    label: "MCP servers (approved only)",
    phase: 19,
    clientMethods: ["listMcpServers", "createMcpServer", "deleteMcpServer"],
    telnyxPaths: ["/ai/mcp_servers"],
    status: "live",
    notes: "approved=false by default; approve via AI platform UI",
  },
  {
    id: "integrations.telnyx",
    label: "Telnyx integration catalog (metadata)",
    phase: 20,
    clientMethods: ["listIntegrations", "listIntegrationConnections"],
    telnyxPaths: ["/ai/integrations"],
    status: "live",
    notes: "Business data stays in Transovo integrations",
  },
  {
    id: "multi_party",
    label: "Multi-participant AI",
    phase: 21,
    clientMethods: ["startAiAssistant"],
    telnyxPaths: ["ai_assistant_start on conference leg"],
    status: "live",
    notes: "Gated by multiPartyEnabled on conference overflow",
  },
  {
    id: "widget",
    label: "Web widget / test console",
    phase: 22,
    clientMethods: ["chatAssistant"],
    telnyxPaths: ["/ai/assistants/{id}/chat"],
    status: "live",
    notes: "/embed/voice/{agentId} + /api/public/voice/widget/chat",
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
    label: "Observability config",
    phase: 25,
    clientMethods: ["updateAssistant"],
    telnyxPaths: ["assistant observability settings"],
    status: "live",
  },
  {
    id: "usage_concurrency",
    label: "Usage + concurrency controls",
    phase: 26,
    clientMethods: [],
    telnyxPaths: [],
    status: "live",
    notes: "assertAiCallAdmission on inbound/outbound AI start",
  },
  {
    id: "outbound_campaigns",
    label: "Unrestricted outbound AI campaigns",
    phase: 17,
    clientMethods: ["createScheduledEvent"],
    telnyxPaths: ["/ai/assistants/{id}/scheduled_events"],
    status: "deferred",
    notes: "Disabled unless outboundAiEnabled + policy",
  },
];

export function capabilityRegistrySnapshot() {
  const counts: Record<string, number> = {};
  for (const c of TELNYX_AI_CAPABILITY_REGISTRY) {
    counts[c.status] = (counts[c.status] || 0) + 1;
  }
  return { total: TELNYX_AI_CAPABILITY_REGISTRY.length, counts, items: TELNYX_AI_CAPABILITY_REGISTRY };
}
