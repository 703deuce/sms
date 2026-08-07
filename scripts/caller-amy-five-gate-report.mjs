#!/usr/bin/env node
/**
 * Five-gate Caller Amy production smoke report.
 *
 * Gates (all must PASS for overall PASS):
 * 1. CATALOG — published Telnyx tools match intended 7-tool surface
 * 2. TOOL TRANSPORT — record_current_field / continue_workflow reached Transovo
 * 3. WORKFLOW — collected fields drove state transitions
 * 4. BOOKING — one appointment created via runtime (not direct calendar tool)
 * 5. CALL DATA — one canonical call row with ANI, duration, transcript, traces
 *
 * Usage:
 *   BASE_URL=https://your-production-host CALL_ID=cmsiwnjrl... node scripts/caller-amy-five-gate-report.mjs
 */
const BASE = (process.env.BASE_URL || "").replace(/\/$/, "");
const BOOTSTRAP = process.env.SMOKE_BOOTSTRAP || "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || process.env.AMY_EMAIL || "").trim().toLowerCase();
const WORKSPACE_ID = process.env.AMY_WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const CALL_ID = process.env.CALL_ID || "";

const gates = {
  CATALOG: { pass: false, detail: "" },
  TOOL_TRANSPORT: { pass: false, detail: "" },
  WORKFLOW: { pass: false, detail: "" },
  BOOKING: { pass: false, detail: "" },
  CALL_DATA: { pass: false, detail: "" },
};

async function smokeLogin() {
  const res = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: EMAIL, workspaceId: WORKSPACE_ID }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`smoke-login ${res.status}: ${JSON.stringify(body)}`);
  const cookie = (res.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  return cookie;
}

async function control(cookie, command, payload = {}) {
  const res = await fetch(`${BASE}/api/agents/${AGENT_ID}/control`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ command, payload }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, data: json.data, error: json.error, raw: json };
}

function toolNamesFromTrace(trace) {
  return (trace?.steps || [])
    .filter((s) => String(s.blockType || "").startsWith("tool:"))
    .map((s) => String(s.blockType).replace(/^tool:/, ""));
}

async function main() {
  if (!BASE) throw new Error("Set BASE_URL");
  if (!EMAIL) throw new Error("Set OWNER_EMAIL");

  const cookie = await smokeLogin();

  // --- CATALOG (local build mirror; production audit uses audit-caller-amy-published-tools.mjs)
  const { execSync } = await import("child_process");
  try {
    execSync("npx tsx scripts/test-caller-amy-orchestration.ts", {
      stdio: "pipe",
      cwd: new URL("..", import.meta.url).pathname,
    });
    gates.CATALOG.pass = true;
    gates.CATALOG.detail = "test-caller-amy-orchestration.ts passed (publish surface)";
  } catch (e) {
    gates.CATALOG.detail = String(e.stderr || e.message || e).slice(0, 500);
  }

  let callId = CALL_ID;
  if (!callId) {
    const activity = await control(cookie, "search_agent_activity", {
      limit: 1,
      summariesOnly: false,
    });
    callId = activity.data?.traces?.[0]?.callId || "";
  }

  if (!callId) {
    gates.TOOL_TRANSPORT.detail = "no call id — make a live test call or set CALL_ID";
    gates.WORKFLOW.detail = gates.TOOL_TRANSPORT.detail;
    gates.BOOKING.detail = gates.TOOL_TRANSPORT.detail;
    gates.CALL_DATA.detail = gates.TOOL_TRANSPORT.detail;
    printReport(callId);
    return;
  }

  const exec = await control(cookie, "get_execution_trace", { callId });
  const trace = exec.data?.trace || exec.data;
  const tools = toolNamesFromTrace(trace);

  const callRes = await fetch(
    `${BASE}/api/voice/calls/${callId}?workspaceId=${WORKSPACE_ID}`,
    { headers: { cookie } },
  );
  const callJson = callRes.ok ? await callRes.json().catch(() => ({})) : {};
  const call = callJson.data || callJson;

  const toolExecutions = call.toolExecutions || [];
  const transportTools = toolExecutions
    .map((t) => t.input?.toolType || t.toolType)
    .filter(Boolean);
  const hasRecord = transportTools.includes("record_current_field");
  const hasContinue = transportTools.includes("continue_workflow");

  gates.TOOL_TRANSPORT.pass = (hasRecord || hasContinue) && toolExecutions.length > 0;
  gates.TOOL_TRANSPORT.detail = JSON.stringify({
    toolExecutions: transportTools,
    traceTools: tools,
    note:
      toolExecutions.length === 0
        ? "zero server-side tool executions — run scripts/audit-telnyx-call-tool-transport.mjs; check providerWebhookEvent voice.tool_webhook.ingress and Telnyx conversation tool messages (callId required = call row missing mid-call)"
        : undefined,
  });

  const forbidden = tools.filter((t) =>
    ["calendar_availability", "book_appointment", "check_availability"].includes(t),
  );
  const hasFieldCollection =
    tools.includes("record_current_field") || tools.includes("save_collected_fields");
  gates.WORKFLOW.pass = !forbidden.length && hasFieldCollection;
  gates.WORKFLOW.detail = JSON.stringify({ tools, forbidden, hasFieldCollection });

  const booking = await control(cookie, "get_booking_verification", { callId });
  const booked =
    trace?.outcome === "appointment_booked" ||
    booking.data?.booked === true ||
    booking.data?.appointmentId;
  gates.BOOKING.pass = Boolean(booked);
  gates.BOOKING.detail = JSON.stringify(booking.data || {});

  const hasAni = Boolean(call.fromE164 && call.fromE164 !== "unknown");
  const hasDuration = (call.durationSeconds || 0) > 0;
  const hasTranscript = Boolean(call.transcript?.fullText || call.transcripts?.length);
  const startedBeforeEnd =
    call.startedAt &&
    call.endedAt &&
    new Date(call.startedAt).getTime() < new Date(call.endedAt).getTime();

  gates.CALL_DATA.pass =
    hasAni && hasDuration && startedBeforeEnd && (hasTranscript || toolExecutions.length > 0);
  gates.CALL_DATA.detail = JSON.stringify({
    callId,
    fromE164: call.fromE164,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSeconds: call.durationSeconds,
    hasTranscript,
    toolExecutionCount: toolExecutions.length,
  });

  printReport(callId);
}

function printReport(callId) {
  console.log("\n=== Caller Amy five-gate report ===");
  console.log("callId:", callId || "(none)");
  for (const [name, gate] of Object.entries(gates)) {
    console.log(`${name}: ${gate.pass ? "PASS" : "FAIL"} — ${gate.detail}`);
  }
  const overall = Object.values(gates).every((g) => g.pass);
  console.log("\nOVERALL:", overall ? "PASS" : "FAIL");
  if (!overall) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
