/**
 * Telnyx AI Voice capability registry — honest wiring status.
 * Status reflects the full path: setting → DB → service → Telnyx → webhook → UI → tests.
 * "live" = production-proven path for core happy path (may still lack live acceptance suite).
 * "wired" = end-to-end product path exists but not live-acceptance proven / has material holes.
 * "partial" = meaningful pieces with clear gaps.
 * "client_only" = ai-client method exists without product surface.
 * "deferred" = intentionally off.
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
      "getAssistant",
      "updateAssistant",
      "deleteAssistant",
      "cloneAssistant",
      "importAssistants",
      "enhanceInstructions",
    ],
    telnyxPaths: ["/ai/assistants", "/ai/assistants/{id}", "/ai/assistants/{id}/clone"],
    status: "partial",
    notes: "Publish/sync/clone wired; import/enhance/delete-remote are client-only; no Telnyx list as SoT",
  },
  {
    id: "assistants.chat",
    label: "Web chat + SMS chat preview",
    phase: 22,
    clientMethods: ["chatAssistant", "smsChatAssistant"],
    telnyxPaths: ["/ai/assistants/{id}/chat", "/ai/assistants/{id}/chat/sms"],
    status: "partial",
    notes: "chat_preview + widget chat wired; smsChatAssistant unused; no WebRTC voice preview",
  },
  {
    id: "routing.inbound",
    label: "Inbound DID → AI start",
    phase: 5,
    clientMethods: ["startAiAssistant"],
    telnyxPaths: ["/calls/{id}/actions/ai_assistant_start"],
    status: "wired",
    notes: "DID join + human_first/ai_after_hours runtime; UI action types expanded",
  },
  {
    id: "dynamic_variables",
    label: "Dynamic variables + webhook",
    phase: 6,
    clientMethods: ["updateAssistant", "startAiAssistant"],
    telnyxPaths: ["assistant.dynamic_variables", "dynamic_variables_webhook_url"],
    status: "wired",
    notes: "Resolve + inject + webhook + memory excludeFields; CRM custom sources thin",
  },
  {
    id: "tools.native",
    label: "Native tools (webhook, hangup, transfer, handoff, DTMF)",
    phase: 7,
    clientMethods: ["sendDtmf", "testAssistantTool", "deleteAssistantTool"],
    telnyxPaths: ["/calls/{id}/actions/send_dtmf", "/ai/assistants/{id}/tools/{toolId}"],
    status: "wired",
    notes: "Builtins include send_dtmf/end_call; async tools enqueue; SIP REFER unsupported",
  },
  {
    id: "transfers",
    label: "Human transfer destinations",
    phase: 8,
    clientMethods: ["transferCall"],
    telnyxPaths: ["/calls/{id}/actions/transfer"],
    status: "wired",
    notes: "Cold/warm + named destinations + transfer-leg cap; SIP REFER unsupported",
  },
  {
    id: "handoffs",
    label: "AI-to-AI handoff",
    phase: 9,
    clientMethods: ["updateAssistant"],
    telnyxPaths: ["tools.type=handoff"],
    status: "partial",
    notes: "Handoff tool sync on publish; no loop prevention / handoff analytics",
  },
  {
    id: "dtmf",
    label: "Send DTMF",
    phase: 10,
    clientMethods: ["sendDtmf"],
    telnyxPaths: ["/calls/{id}/actions/send_dtmf"],
    status: "wired",
    notes: "Builtin tool + API action with charset validation",
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
    status: "partial",
    notes: "Sync list + message sync on sync_conversations; update/delete/retention incomplete",
  },
  {
    id: "knowledge",
    label: "Knowledge bases / RAG",
    phase: 12,
    clientMethods: [],
    telnyxPaths: ["/ai/embeddings"],
    status: "wired",
    notes: "Existing rag.ts + storage + attach; KB PATCH/DELETE thin; citations synthetic",
  },
  {
    id: "memory",
    label: "Memory / privacy settings",
    phase: 13,
    clientMethods: ["updateAssistant"],
    telnyxPaths: ["privacy_settings"],
    status: "partial",
    notes: "Save/clear/enrich + excludeFields; no memory preview/audit trail",
  },
  {
    id: "versions",
    label: "Assistant versions + promote",
    phase: 14,
    clientMethods: ["listVersions", "getVersion", "updateVersion", "deleteVersion", "promoteVersion"],
    telnyxPaths: ["/ai/assistants/{id}/versions"],
    status: "partial",
    notes: "Local rollback + remote sync/promote; no compare UI; no publish gate on tests",
  },
  {
    id: "canary",
    label: "Canary deploys",
    phase: 15,
    clientMethods: ["getCanary", "createCanary", "updateCanary", "deleteCanary"],
    telnyxPaths: ["/ai/assistants/{id}/canary-deploys"],
    status: "partial",
    notes: "Upsert/delete UI; version_id often 'main'; no per-version metrics",
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
    status: "partial",
    notes: "Default suite seeds 12 tests; publish not gated on pass; no scheduled regression",
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
    status: "partial",
    notes: "SMS path + quiet hours + suppression; phone_call gated by outboundAiEnabled",
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
    status: "partial",
    notes: "Seed 14 defaults + signed webhook ingest; CRM persist still mostly post-call heuristic",
  },
  {
    id: "mcp",
    label: "MCP servers (approved only)",
    phase: 19,
    clientMethods: ["listMcpServers", "createMcpServer", "deleteMcpServer"],
    telnyxPaths: ["/ai/mcp_servers"],
    status: "partial",
    notes: "Register/approve/reject + attach approved; no Transovo-hosted MCP server yet",
  },
  {
    id: "integrations.telnyx",
    label: "Telnyx integration catalog (metadata)",
    phase: 20,
    clientMethods: ["listIntegrations", "listIntegrationConnections"],
    telnyxPaths: ["/ai/integrations"],
    status: "wired",
    notes: "Catalog metadata; business data stays in Transovo integrations",
  },
  {
    id: "multi_party",
    label: "Multi-participant AI",
    phase: 21,
    clientMethods: ["startAiAssistant"],
    telnyxPaths: ["ai_assistant_start on conference leg"],
    status: "partial",
    notes: "multiPartyEnabled gate on conference overflow only; no silent/listen modes",
  },
  {
    id: "widget",
    label: "Web widget / test console",
    phase: 22,
    clientMethods: ["chatAssistant"],
    telnyxPaths: ["/ai/assistants/{id}/chat"],
    status: "partial",
    notes: "Embed chat + allowlist/rate/CAPTCHA gate; no short-lived browser creds / voice WebRTC",
  },
  {
    id: "sms_cross_channel",
    label: "SMS assistant chat",
    phase: 23,
    clientMethods: ["smsChatAssistant"],
    telnyxPaths: ["/ai/assistants/{id}/chat/sms"],
    status: "partial",
    notes: "send_sms builtin + messaging gates; Telnyx sms chat API unused; timeline not unified",
  },
  {
    id: "observability",
    label: "Observability config",
    phase: 25,
    clientMethods: ["updateAssistant"],
    telnyxPaths: ["assistant observability settings"],
    status: "partial",
    notes: "Config + enabled_features enrich; no latency dashboard / Langfuse customer surface",
  },
  {
    id: "usage_concurrency",
    label: "Usage + concurrency controls",
    phase: 26,
    clientMethods: [],
    telnyxPaths: [],
    status: "wired",
    notes: "Admission + soft alerts + spend hard cap + transfer-leg cap; no plan/trial allowances",
  },
  {
    id: "outbound_campaigns",
    label: "Unrestricted outbound AI campaigns",
    phase: 17,
    clientMethods: ["createScheduledEvent"],
    telnyxPaths: ["/ai/assistants/{id}/scheduled_events"],
    status: "deferred",
    notes: "Disabled unless outboundAiEnabled + consent",
  },
];

export function capabilityRegistrySnapshot() {
  const counts: Record<string, number> = {};
  for (const c of TELNYX_AI_CAPABILITY_REGISTRY) {
    counts[c.status] = (counts[c.status] || 0) + 1;
  }
  return { total: TELNYX_AI_CAPABILITY_REGISTRY.length, counts, items: TELNYX_AI_CAPABILITY_REGISTRY };
}
