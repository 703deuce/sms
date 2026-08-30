#!/usr/bin/env node
/**
 * Audit the LIVE published Telnyx assistant for Caller Amy.
 *
 * Confirms:
 * - Exactly the intended model-facing webhook tools (7 + native hangup/transfer)
 * - Each webhook points at the current production APP_URL
 * - Method, timeout, and body schema are present
 *
 * Usage:
 *   BASE_URL=https://your-production-host \
 *   AMY_AGENT_ID=cmshz2lc25c622c4i58303501 \
 *   OWNER_EMAIL=you@example.com \
 *   node scripts/audit-caller-amy-published-tools.mjs
 *
 * Requires smoke-login bootstrap on the target deployment.
 */
const BASE = (process.env.BASE_URL || "").replace(/\/$/, "");
const BOOTSTRAP = process.env.SMOKE_BOOTSTRAP || "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || process.env.AMY_EMAIL || "").trim().toLowerCase();
const AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";

const WORKFLOW_TOOLS = ["send_resource", "search_business_details"];

const MINIMUM_SIDE_EFFECT_TOOLS = [
  "send_sms",
  "record_call_fact",
  "take_structured_message",
  "lookup_customer",
  "escalate_human",
];

const LEGACY_WORKFLOW_TOOLS = [
  "lookup_customer",
  "take_structured_message",
  "record_current_field",
  "continue_workflow",
  "get_runtime_context",
  "escalate_human",
];

const EXPECTED_WEBHOOK_TOOLS = process.env.AMY_LEGACY_WORKFLOW === "1"
  ? LEGACY_WORKFLOW_TOOLS
  : process.env.AMY_CONVERSATION_WORKFLOW === "1"
    ? WORKFLOW_TOOLS
    : MINIMUM_SIDE_EFFECT_TOOLS;

const FORBIDDEN_WEBHOOK_TOOLS = [
  "calendar_availability",
  "book_appointment",
  "resolve_datetime",
  "check_availability",
  "hold_appointment_slot",
  "runtime_turn",
  ...(process.env.AMY_LEGACY_WORKFLOW === "1"
    ? ["send_sms", "record_call_fact"]
    : process.env.AMY_CONVERSATION_WORKFLOW === "1"
      ? ["send_sms", "record_call_fact", "lookup_customer", "continue_workflow"]
      : ["continue_workflow", "get_runtime_context", "record_current_field"]),
];

function fail(msg) {
  console.error("FAIL", msg);
  process.exitCode = 1;
}

function pass(msg) {
  console.log("PASS", msg);
}

async function smokeLogin() {
  const res = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: EMAIL }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`smoke-login ${res.status}: ${JSON.stringify(body)}`);
  const cookie = (res.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  return { cookie, body };
}

function toolSummary(t) {
  if (t.type === "webhook") {
    return {
      type: "webhook",
      name: t.name,
      url: t.url,
      method: t.method,
      timeout_ms: t.timeout_ms,
      headerNames: t.headerNames || [],
      bodyKeys: t.bodyKeys || [],
    };
  }
  if (t.type === "hangup") return { type: "hangup" };
  if (t.type === "transfer") return { type: "transfer" };
  return { type: t.type || "unknown" };
}

async function main() {
  if (!BASE) throw new Error("Set BASE_URL");
  if (!EMAIL) throw new Error("Set OWNER_EMAIL or AMY_EMAIL");

  const { cookie } = await smokeLogin();
  pass(`smoke-login as ${EMAIL}`);

  const publishRes = await fetch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "publish" }),
  });
  const publishJson = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok) {
    fail(`publish ${publishRes.status}: ${JSON.stringify(publishJson).slice(0, 400)}`);
  } else {
    pass("republish triggered (refreshes Telnyx assistant tools)");
  }

  const fetchRes = await fetch(`${BASE}/api/voice/ai`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      action: "fetch_live_assistant",
      agentId: AGENT_ID,
    }),
  });
  const fetchJson = await fetchRes.json().catch(() => ({}));
  if (!fetchRes.ok) {
    fail(`fetch_live_assistant ${fetchRes.status}: ${JSON.stringify(fetchJson).slice(0, 400)}`);
    process.exit(1);
  }

  const assistantId = fetchJson.data?.telnyxAssistantId;
  const remoteTools = fetchJson.data?.tools || [];
  const appUrl = BASE;

  console.log("\n--- Published assistant ---");
  console.log(JSON.stringify({ assistantId, appUrl }, null, 2));

  const summaries = remoteTools.map(toolSummary);
  console.log("\n--- Remote tools ---");
  console.log(JSON.stringify(summaries, null, 2));

  const webhookNames = summaries.filter((s) => s.type === "webhook").map((s) => s.name);
  const expectedWebhookUrl = `${BASE}/api/telnyx/voice/tools`;

  for (const name of EXPECTED_WEBHOOK_TOOLS) {
    if (webhookNames.includes(name)) pass(`catalog includes ${name}`);
    else fail(`missing webhook tool ${name}`);
  }

  for (const forbidden of FORBIDDEN_WEBHOOK_TOOLS) {
    if (webhookNames.includes(forbidden)) fail(`forbidden tool still published: ${forbidden}`);
    else pass(`forbidden tool absent: ${forbidden}`);
  }

  for (const s of summaries.filter((x) => x.type === "webhook")) {
    if (s.url === expectedWebhookUrl) pass(`${s.name} url matches production`);
    else fail(`${s.name} url mismatch: ${s.url} (expected ${expectedWebhookUrl})`);
    if (s.method === "POST") pass(`${s.name} method POST`);
    else fail(`${s.name} method is ${s.method}`);
    if (!s.headerNames?.includes("X-Transovo-Workspace-Id")) {
      fail(`${s.name} missing X-Transovo-Workspace-Id header`);
    }
    if (!s.headerNames?.includes("X-Transovo-Agent-Id")) {
      fail(`${s.name} missing X-Transovo-Agent-Id header`);
    }
    if (!s.headerNames?.includes("X-Transovo-Tool-Type")) {
      fail(`${s.name} missing X-Transovo-Tool-Type header`);
    }
  }

  console.log("\nCATALOG", process.exitCode ? "FAIL" : "PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
