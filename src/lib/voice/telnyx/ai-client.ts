/**
 * Centralized Telnyx AI Assistants API client for Transovo.
 *
 * Thin typed wrappers over `telnyxRequest`. Bodies are `Record<string, unknown>`
 * where OpenAPI schemas vary. Path segments are always encodeURIComponent'd.
 * Optional list filters go through the `query` arg. TelnyxApiError propagates
 * for callers to handle account/feature gaps.
 */

import { telnyxRequest, TelnyxApiError } from "@/lib/messaging/telnyx/client";

export { TelnyxApiError };

export type TelnyxAiQuery = Record<string, string | number | undefined | null>;
export type TelnyxAiBody = Record<string, unknown>;

/** AI Assistants need only an API key (Call Control connection is separate). */
export function isTelnyxAiConfigured() {
  return Boolean(process.env.TELNYX_API_KEY?.trim());
}

function enc(segment: string) {
  return encodeURIComponent(segment);
}

// ── Assistants ──────────────────────────────────────────────────────────────

export async function listAssistants(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/assistants", { query });
}

export async function createAssistant(body: TelnyxAiBody) {
  return telnyxRequest("/ai/assistants", { method: "POST", body });
}

export async function getAssistant(id: string, query?: TelnyxAiQuery) {
  return telnyxRequest(`/ai/assistants/${enc(id)}`, { query });
}

/** Telnyx docs use PATCH for assistant updates; older clients used POST. Try PATCH first. */
export async function updateAssistant(id: string, body: TelnyxAiBody) {
  try {
    return await telnyxRequest(`/ai/assistants/${enc(id)}`, {
      method: "PATCH",
      body,
      noRetry: true,
    });
  } catch (err) {
    if (!(err instanceof TelnyxApiError)) throw err;
    // Method not supported → fall back to POST (legacy behavior).
    if (err.status === 405 || err.status === 501) {
      return telnyxRequest(`/ai/assistants/${enc(id)}`, { method: "POST", body });
    }
    // Some accounts reject PATCH with a generic 4xx even though POST works.
    // Do not swallow validation errors like "Voice not found" — surface them.
    const msg = err.message.toLowerCase();
    if (
      msg.includes("voice not found") ||
      msg.includes("expressive_mode") ||
      msg.includes("unprocessable")
    ) {
      throw err;
    }
    try {
      return await telnyxRequest(`/ai/assistants/${enc(id)}`, { method: "POST", body });
    } catch {
      throw err;
    }
  }
}

export async function deleteAssistant(id: string) {
  return telnyxRequest(`/ai/assistants/${enc(id)}`, { method: "DELETE" });
}

export async function cloneAssistant(id: string, body?: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/clone`, {
    method: "POST",
    body: body ?? {},
  });
}

export async function importAssistants(body: TelnyxAiBody) {
  return telnyxRequest("/ai/assistants/import", { method: "POST", body });
}

export async function enhanceInstructions(id: string, body?: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/instructions/enhance`, {
    method: "POST",
    body: body ?? {},
  });
}

/**
 * Chat with an assistant.
 * Telnyx expects `{ content, conversation_id?, name? }` — not OpenAI-style messages[].
 */
export async function chatAssistant(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/chat`, { method: "POST", body });
}

export async function smsChatAssistant(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/chat/sms`, { method: "POST", body });
}

/** Create a Telnyx AI conversation (for chat continuity). */
export async function createConversation(body?: TelnyxAiBody) {
  return telnyxRequest("/ai/conversations", { method: "POST", body: body || {} });
}

export async function getAssistantTexml(id: string) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/texml`);
}

// ── Versions ────────────────────────────────────────────────────────────────

export async function listVersions(id: string, query?: TelnyxAiQuery) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/versions`, { query });
}

export async function getVersion(id: string, versionId: string, query?: TelnyxAiQuery) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/versions/${enc(versionId)}`, { query });
}

export async function updateVersion(id: string, versionId: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/versions/${enc(versionId)}`, {
    method: "POST",
    body,
  });
}

export async function deleteVersion(id: string, versionId: string) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/versions/${enc(versionId)}`, {
    method: "DELETE",
  });
}

export async function promoteVersion(id: string, versionId: string, body?: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/versions/${enc(versionId)}/promote`, {
    method: "POST",
    body: body ?? {},
  });
}

// ── Canary deploys ──────────────────────────────────────────────────────────

export async function getCanary(id: string) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/canary-deploys`);
}

export async function createCanary(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/canary-deploys`, {
    method: "POST",
    body,
  });
}

export async function updateCanary(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/canary-deploys`, {
    method: "PUT",
    body,
  });
}

export async function deleteCanary(id: string) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/canary-deploys`, { method: "DELETE" });
}

// ── Tests ───────────────────────────────────────────────────────────────────

export async function listTests(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/assistants/tests", { query });
}

export async function createTest(body: TelnyxAiBody) {
  return telnyxRequest("/ai/assistants/tests", { method: "POST", body });
}

export async function getTest(testId: string) {
  return telnyxRequest(`/ai/assistants/tests/${enc(testId)}`);
}

export async function updateTest(testId: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/tests/${enc(testId)}`, { method: "PUT", body });
}

export async function deleteTest(testId: string) {
  return telnyxRequest(`/ai/assistants/tests/${enc(testId)}`, { method: "DELETE" });
}

export async function listTestRuns(testId: string, query?: TelnyxAiQuery) {
  return telnyxRequest(`/ai/assistants/tests/${enc(testId)}/runs`, { query });
}

export async function triggerTestRun(testId: string, body?: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/tests/${enc(testId)}/runs`, {
    method: "POST",
    body: body ?? {},
  });
}

export async function getTestRun(testId: string, runId: string) {
  return telnyxRequest(`/ai/assistants/tests/${enc(testId)}/runs/${enc(runId)}`);
}

export async function listTestSuites(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/assistants/tests/test-suites", { query });
}

export async function listSuiteRuns(suiteName: string, query?: TelnyxAiQuery) {
  return telnyxRequest(`/ai/assistants/tests/test-suites/${enc(suiteName)}/runs`, {
    query,
  });
}

export async function triggerSuiteRun(suiteName: string, body?: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/tests/test-suites/${enc(suiteName)}/runs`, {
    method: "POST",
    body: body ?? {},
  });
}

// ── Scheduled events ────────────────────────────────────────────────────────

export async function listScheduledEvents(id: string, query?: TelnyxAiQuery) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/scheduled_events`, { query });
}

export async function createScheduledEvent(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/scheduled_events`, {
    method: "POST",
    body,
  });
}

export async function getScheduledEvent(id: string, eventId: string) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/scheduled_events/${enc(eventId)}`);
}

export async function deleteScheduledEvent(id: string, eventId: string) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/scheduled_events/${enc(eventId)}`, {
    method: "DELETE",
  });
}

// ── Tags ────────────────────────────────────────────────────────────────────

export async function listTags(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/assistants/tags", { query });
}

export async function assignTags(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/tags`, { method: "POST", body });
}

export async function removeTag(id: string, tag: string) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/tags/${enc(tag)}`, { method: "DELETE" });
}

// ── MCP servers ─────────────────────────────────────────────────────────────

export async function listMcpServers(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/mcp_servers", { query });
}

export async function createMcpServer(body: TelnyxAiBody) {
  return telnyxRequest("/ai/mcp_servers", { method: "POST", body });
}

export async function getMcpServer(id: string) {
  return telnyxRequest(`/ai/mcp_servers/${enc(id)}`);
}

/** Live OpenAPI: PUT /ai/mcp_servers/{mcp_server_id} */
export async function updateMcpServer(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/mcp_servers/${enc(id)}`, { method: "PUT", body });
}

export async function deleteMcpServer(id: string) {
  return telnyxRequest(`/ai/mcp_servers/${enc(id)}`, { method: "DELETE" });
}

// ── Integration secrets (ElevenLabs api_key_ref, etc.) ──────────────────────

export async function listIntegrationSecrets(query?: TelnyxAiQuery) {
  return telnyxRequest("/integration_secrets", { query });
}

export async function createIntegrationSecret(body: {
  identifier: string;
  type: "bearer" | "basic";
  token?: string;
  username?: string;
  password?: string;
}) {
  return telnyxRequest("/integration_secrets", {
    method: "POST",
    body,
    noRetry: true,
  });
}

export async function deleteIntegrationSecret(id: string) {
  return telnyxRequest(`/integration_secrets/${enc(id)}`, { method: "DELETE" });
}

// ── Integrations ────────────────────────────────────────────────────────────

export async function listIntegrations(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/integrations", { query });
}

export async function listIntegrationConnections(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/integrations/connections", { query });
}

export async function getIntegration(id: string) {
  return telnyxRequest(`/ai/integrations/${enc(id)}`);
}

export async function getIntegrationConnection(id: string) {
  return telnyxRequest(`/ai/integrations/connections/${enc(id)}`);
}

export async function deleteIntegrationConnection(id: string) {
  return telnyxRequest(`/ai/integrations/connections/${enc(id)}`, { method: "DELETE" });
}

// ── Assistant tools ─────────────────────────────────────────────────────────

export async function testAssistantTool(id: string, toolId: string, body?: TelnyxAiBody) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/tools/${enc(toolId)}/test`, {
    method: "POST",
    body: body ?? {},
  });
}

export async function deleteAssistantTool(id: string, toolId: string) {
  return telnyxRequest(`/ai/assistants/${enc(id)}/tools/${enc(toolId)}`, {
    method: "DELETE",
  });
}

// ── Conversations ───────────────────────────────────────────────────────────

export async function listConversations(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/conversations", { query });
}

export async function getConversation(id: string) {
  return telnyxRequest(`/ai/conversations/${enc(id)}`);
}

/** Live OpenAPI: PUT /ai/conversations/{conversation_id} */
export async function updateConversation(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/conversations/${enc(id)}`, { method: "PUT", body });
}

export async function deleteConversation(id: string) {
  return telnyxRequest(`/ai/conversations/${enc(id)}`, { method: "DELETE" });
}

export async function listConversationMessages(id: string, query?: TelnyxAiQuery) {
  return telnyxRequest(`/ai/conversations/${enc(id)}/messages`, { query });
}

export async function addConversationMessage(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/conversations/${enc(id)}/message`, { method: "POST", body });
}

export async function getConversationInsights(id: string) {
  return telnyxRequest(`/ai/conversations/${enc(id)}/conversations-insights`);
}

export async function listInsights(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/conversations/insights", { query });
}

export async function createInsight(body: TelnyxAiBody) {
  return telnyxRequest("/ai/conversations/insights", { method: "POST", body });
}

export async function getInsight(id: string) {
  return telnyxRequest(`/ai/conversations/insights/${enc(id)}`);
}

/** Live OpenAPI: PUT /ai/conversations/insights/{insight_id} */
export async function updateInsight(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/conversations/insights/${enc(id)}`, { method: "PUT", body });
}

export async function deleteInsight(id: string) {
  return telnyxRequest(`/ai/conversations/insights/${enc(id)}`, { method: "DELETE" });
}

export async function listInsightGroups(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/conversations/insight-groups", { query });
}

export async function createInsightGroup(body: TelnyxAiBody) {
  return telnyxRequest("/ai/conversations/insight-groups", { method: "POST", body });
}

export async function getInsightGroup(id: string) {
  return telnyxRequest(`/ai/conversations/insight-groups/${enc(id)}`);
}

/** Live OpenAPI: PUT /ai/conversations/insight-groups/{group_id} */
export async function updateInsightGroup(id: string, body: TelnyxAiBody) {
  return telnyxRequest(`/ai/conversations/insight-groups/${enc(id)}`, {
    method: "PUT",
    body,
  });
}

export async function deleteInsightGroup(id: string) {
  return telnyxRequest(`/ai/conversations/insight-groups/${enc(id)}`, { method: "DELETE" });
}

export async function assignInsightToGroup(groupId: string, insightId: string, body?: TelnyxAiBody) {
  return telnyxRequest(
    `/ai/conversations/insight-groups/${enc(groupId)}/insights/${enc(insightId)}/assign`,
    { method: "POST", body: body ?? {} },
  );
}

/** Live OpenAPI: DELETE …/unassign */
export async function unassignInsightFromGroup(groupId: string, insightId: string) {
  return telnyxRequest(
    `/ai/conversations/insight-groups/${enc(groupId)}/insights/${enc(insightId)}/unassign`,
    { method: "DELETE" },
  );
}

export async function insightAggregates(query?: TelnyxAiQuery) {
  return telnyxRequest("/ai/conversations/conversation-insights/aggregates", { query });
}

// ── Call control helpers (AI voice runtime) ─────────────────────────────────

export async function sendDtmf(callControlId: string, digits: string) {
  return telnyxRequest(`/calls/${enc(callControlId)}/actions/send_dtmf`, {
    method: "POST",
    body: { digits },
  });
}

/**
 * Attach an AI Assistant to an active Call Control leg.
 * Tries `ai_assistant_start`, then `start_ai_assistant` (same fallback as assistant-sync).
 */
export async function startAiAssistant(callControlId: string, body: TelnyxAiBody) {
  try {
    return await telnyxRequest(`/calls/${enc(callControlId)}/actions/ai_assistant_start`, {
      method: "POST",
      body,
    });
  } catch (err) {
    if (!(err instanceof TelnyxApiError)) throw err;
    return telnyxRequest(`/calls/${enc(callControlId)}/actions/start_ai_assistant`, {
      method: "POST",
      body,
    });
  }
}

export async function hangupCall(callControlId: string, body?: TelnyxAiBody) {
  return telnyxRequest(`/calls/${enc(callControlId)}/actions/hangup`, {
    method: "POST",
    body: body ?? {},
  });
}

export async function transferCall(callControlId: string, body: TelnyxAiBody) {
  return telnyxRequest(`/calls/${enc(callControlId)}/actions/transfer`, {
    method: "POST",
    body,
  });
}

/**
 * Capability id → primary client method used to probe / exercise that surface.
 * Aligns with the Telnyx AI voice coverage matrix (Wave C registry).
 */
export const TELNYX_AI_CAPABILITY_METHODS = {
  assistants: "listAssistants",
  versions: "listVersions",
  canaries: "getCanary",
  tests: "listTests",
  test_suites: "listTestSuites",
  scheduled_events: "listScheduledEvents",
  tags: "listTags",
  mcp_servers: "listMcpServers",
  integrations: "listIntegrations",
  integration_connections: "listIntegrationConnections",
  conversations: "listConversations",
  insights: "listInsights",
  insight_groups: "listInsightGroups",
  insight_aggregates: "insightAggregates",
  assistant_tools: "testAssistantTool",
  send_dtmf: "sendDtmf",
  start_ai_assistant: "startAiAssistant",
  hangup: "hangupCall",
  transfer: "transferCall",
} as const;
