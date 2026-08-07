#!/usr/bin/env node
/**
 * Telnyx-side tool invocation audit for a production phone call.
 *
 * Cross-checks:
 * - Live published assistant catalog (7 webhook tools + hangup)
 * - Telnyx conversation messages for tool / function calls
 * - Transovo call row + voiceToolExecution rows (when BASE_URL + CALL_ID set)
 *
 * Usage:
 *   TELNYX_API_KEY=... \
 *   TELNYX_ASSISTANT_ID=assistant-197f496d-... \
 *   CONVERSATION_ID=0758951c-... \
 *   BASE_URL=https://your-production-host \
 *   CALL_ID=cmsiwnjrl5s4e2w3j1p3n4g34 \
 *   OWNER_EMAIL=you@example.com \
 *   node scripts/audit-telnyx-call-tool-transport.mjs
 */
const API = "https://api.telnyx.com/v2";
const KEY = process.env.TELNYX_API_KEY || "";
const ASSISTANT_ID =
  process.env.TELNYX_ASSISTANT_ID || "assistant-197f496d-d98a-4995-ad0e-a10aca90951d";
const CONVERSATION_ID = process.env.CONVERSATION_ID || "";
const CALL_CONTROL_ID = process.env.CALL_CONTROL_ID || "";
const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const CALL_ID = process.env.CALL_ID || "";
const BOOTSTRAP = process.env.SMOKE_BOOTSTRAP || "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || process.env.AMY_EMAIL || "").trim().toLowerCase();

const EXPECTED_WEBHOOKS = [
  "lookup_customer",
  "take_structured_message",
  "record_current_field",
  "continue_workflow",
  "get_runtime_context",
  "escalate_human",
];

async function telnyx(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Telnyx ${path} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

function summarizeTools(tools) {
  return (tools || []).map((t) => {
    if (t.type === "webhook") {
      return {
        type: "webhook",
        name: t.webhook?.name,
        url: t.webhook?.url,
        method: t.webhook?.method,
        timeout_ms: t.webhook?.timeout_ms,
      };
    }
    return { type: t.type };
  });
}

function extractToolInvocations(messages) {
  const invocations = [];
  for (const m of messages || []) {
    const role = m.role || m.sender || m.type || "unknown";
    const content = m.content ?? m.text ?? "";
    if (role === "tool" || role === "function") {
      invocations.push({
        role,
        content: typeof content === "string" ? content.slice(0, 500) : JSON.stringify(content).slice(0, 500),
      });
      continue;
    }
    const toolCalls = m.tool_calls || m.toolCalls;
    if (Array.isArray(toolCalls) && toolCalls.length) {
      for (const tc of toolCalls) {
        invocations.push({
          role: "assistant_tool_call",
          name: tc.function?.name || tc.name,
          arguments: tc.function?.arguments || tc.arguments,
        });
      }
    }
    if (typeof content === "string" && content.includes('"error":"callId required"')) {
      invocations.push({ role: "tool_result", error: "callId required", snippet: content.slice(0, 200) });
    }
  }
  return invocations;
}

async function smokeLogin() {
  const res = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-smoke-bootstrap": BOOTSTRAP },
    body: JSON.stringify({ email: EMAIL, workspaceId: "ws_1" }),
  });
  if (!res.ok) throw new Error(`smoke-login ${res.status}`);
  return (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
}

async function fetchTransovoCall(cookie) {
  if (!BASE || !CALL_ID) return null;
  const res = await fetch(`${BASE}/api/voice/calls/${CALL_ID}?workspaceId=ws_1`, {
    headers: { cookie },
  });
  if (!res.ok) return { error: res.status };
  const json = await res.json();
  return json.data || json;
}

async function resolveConversationId() {
  if (CONVERSATION_ID) return CONVERSATION_ID;
  if (!CALL_CONTROL_ID) return "";
  const list = await telnyx("/ai/conversations?page[size]=30");
  const match = (list.data || []).find(
    (c) =>
      String(c.metadata?.call_control_id || "").includes(CALL_CONTROL_ID) ||
      JSON.stringify(c).includes(CALL_CONTROL_ID),
  );
  return match?.id || "";
}

async function main() {
  if (!KEY) throw new Error("Set TELNYX_API_KEY");

  const report = {
    CATALOG: { pass: false, detail: "" },
    TELNYX_TOOL_ATTEMPTS: { pass: false, detail: "" },
    TRANSOVO_TOOL_EXECUTIONS: { pass: false, detail: "" },
    CALL_ID_BINDING: { pass: false, detail: "" },
  };

  const versions = await telnyx(`/ai/assistants/${ASSISTANT_ID}/versions`);
  const promoted =
    (versions.data || []).find((v) => v.is_promoted) || versions.data?.[0];
  const tools = summarizeTools(promoted?.tools);
  const webhookNames = tools.filter((t) => t.type === "webhook").map((t) => t.name);
  const catalogOk =
    EXPECTED_WEBHOOKS.every((n) => webhookNames.includes(n)) &&
    !webhookNames.includes("calendar_availability");
  report.CATALOG.pass = catalogOk;
  report.CATALOG.detail = JSON.stringify({ webhookNames, toolCount: tools.length });

  const convId = await resolveConversationId();
  let messages = [];
  if (convId) {
    const msgRes = await telnyx(`/ai/conversations/${convId}/messages?page[size]=100`);
    messages = msgRes.data || [];
  }
  const invocations = extractToolInvocations(messages);
  const attemptedNames = invocations
    .map((i) => i.name)
    .filter(Boolean);
  const hasCallIdError = invocations.some(
    (i) => i.error === "callId required" || String(i.content || "").includes("callId required"),
  );
  report.TELNYX_TOOL_ATTEMPTS.pass = invocations.length > 0;
  report.TELNYX_TOOL_ATTEMPTS.detail = JSON.stringify({
    conversationId: convId || null,
    invocationCount: invocations.length,
    attemptedNames,
    hasCallIdError,
    invocations: invocations.slice(0, 12),
  });

  let transovo = null;
  if (BASE && EMAIL && CALL_ID) {
    const cookie = await smokeLogin();
    transovo = await fetchTransovoCall(cookie);
    const toolExecutions = transovo?.toolExecutions || transovo?.call?.toolExecutions || [];
    const transportTypes = toolExecutions.map(
      (t) => t.input?.toolType || t.toolType,
    );
    report.TRANSOVO_TOOL_EXECUTIONS.pass =
      transportTypes.includes("record_current_field") ||
      transportTypes.includes("continue_workflow") ||
      transportTypes.includes("get_runtime_context");
    report.TRANSOVO_TOOL_EXECUTIONS.detail = JSON.stringify({
      toolExecutionCount: toolExecutions.length,
      transportTypes,
    });
    const call = transovo?.call || transovo;
    report.CALL_ID_BINDING.pass = Boolean(
      call?.telnyxCallControlId &&
        (call?.telnyxConversationId || convId) &&
        call?.fromE164 &&
        call.fromE164 !== "unknown",
    );
    report.CALL_ID_BINDING.detail = JSON.stringify({
      callId: call?.id,
      fromE164: call?.fromE164,
      startedAt: call?.startedAt,
      endedAt: call?.endedAt,
      durationSeconds: call?.durationSeconds,
      telnyxCallControlId: call?.telnyxCallControlId,
      telnyxConversationId: call?.telnyxConversationId,
      transcriptCount: transovo?.transcripts?.length ?? 0,
    });
  } else {
    report.TRANSOVO_TOOL_EXECUTIONS.detail = "Set BASE_URL, OWNER_EMAIL, CALL_ID for Transovo side";
    report.CALL_ID_BINDING.detail = "Set BASE_URL, CALL_ID for call binding check";
  }

  console.log("\n=== Telnyx call tool transport audit ===\n");
  for (const [k, v] of Object.entries(report)) {
    console.log(`${k}: ${v.pass ? "PASS" : "FAIL"} — ${v.detail}`);
  }

  const transportLikelyBroken =
    report.TELNYX_TOOL_ATTEMPTS.pass &&
    hasCallIdError &&
    !report.TRANSOVO_TOOL_EXECUTIONS.pass;
  if (transportLikelyBroken) {
    console.log(
      "\nDIAGNOSIS: Telnyx invoked tools but Transovo had no callId — deploy ensureVoiceCallForToolWebhook + early TeXML lifecycle.",
    );
  }

  const overall =
    report.CATALOG.pass &&
    report.TELNYX_TOOL_ATTEMPTS.pass &&
    report.TRANSOVO_TOOL_EXECUTIONS.pass &&
    report.CALL_ID_BINDING.pass;
  console.log("\nTOOL TRANSPORT (combined):", overall ? "PASS" : "FAIL");
  if (!overall) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
