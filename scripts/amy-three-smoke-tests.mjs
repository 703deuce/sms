/**
 * Three smoke tests (unchanged scenarios):
 * 1. CALLER AMY — latest call tool trace (calendar blocked during COLLECTING_FIELDS?)
 * 2. OWNER AMY — investigative sink question (semantic tools, not fallback)
 * 3. WORKFLOW ARCHITECT — Property Type field candidate
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = process.env.AMY_EMAIL || "703deuce@gmail.com";
const WORKSPACE_ID = process.env.AMY_WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";

const OWNER_SINK_QUESTION =
  "Did the person who called about the leaking kitchen sink get booked?";
const ARCHITECT_FIELD_QUESTION =
  "Add a required Property Type field with House, Apartment, or Commercial";

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
  const setCookie = res.headers.getSetCookie?.() || [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  return { cookie, body };
}

async function control(cookie, command, payload = {}) {
  const res = await fetch(`${BASE}/api/agents/${AGENT_ID}/control`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ command, payload }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json.data, error: json.error, raw: json };
}

async function ownerAsk(cookie, question) {
  return control(cookie, "owner_ask", { question });
}

function toolNamesFromTrace(trace) {
  return (trace?.steps || [])
    .filter((s) => String(s.blockType || "").startsWith("tool:"))
    .map((s) => String(s.blockType).replace(/^tool:/, ""));
}

async function main() {
  const report = {
    base: BASE,
    agentId: AGENT_ID,
    startedAt: new Date().toISOString(),
    callerAmy: { pass: false, evidence: {} },
    ownerAmy: { pass: false, evidence: {} },
    workflowArchitect: { pass: false, evidence: {} },
  };

  const { cookie } = await smokeLogin();

  // --- CALLER AMY: inspect latest call ---
  const activity = await control(cookie, "search_agent_activity", {
    limit: 3,
    summariesOnly: false,
  });
  const traces = activity.data?.traces || [];
  const latest = traces[0];
  report.callerAmy.evidence.latestTraces = traces.map((t) => ({
    callId: t.callId,
    summary: t.summary,
    outcome: t.outcome,
    startedAt: t.startedAt,
    callerPhone: t.callerPhone,
  }));

  if (latest?.callId) {
    const exec = await control(cookie, "get_execution_trace", { callId: latest.callId });
    const trace = exec.data?.trace || exec.data;
    const tools = toolNamesFromTrace(trace);
    const toolExecRes = await fetch(
      `${BASE}/api/voice/calls/${latest.callId}?workspaceId=${WORKSPACE_ID}`,
      { headers: { cookie } },
    ).catch(() => null);
    let toolExecutions = [];
    if (toolExecRes?.ok) {
      const callJson = await toolExecRes.json().catch(() => ({}));
      toolExecutions = callJson.data?.toolExecutions || callJson.toolExecutions || [];
    }

    report.callerAmy.evidence.callId = latest.callId;
    report.callerAmy.evidence.toolsFromTrace = tools;
    report.callerAmy.evidence.trace = trace;
    report.callerAmy.evidence.bookingVerification = (
      await control(cookie, "get_booking_verification", { callId: latest.callId })
    ).data;

    const calendarDuringCollect =
      tools.includes("calendar_availability") || tools.includes("check_availability");
    const hasRecordField =
      tools.includes("record_current_field") || tools.includes("save_collected_fields");
    const booked = latest.outcome === "appointment_booked" || trace?.outcome === "appointment_booked";

    // PASS if scheduling tools were blocked during collection (no calendar bypass).
    // Booking not completing is expected until fields + workflow complete.
    report.callerAmy.pass = !calendarDuringCollect;
    report.callerAmy.evidence.verdict = calendarDuringCollect
      ? "FAIL: calendar_availability ran during collection — workflow guard bypassed"
      : hasRecordField
        ? "PASS: no calendar bypass; field collection path active"
        : booked
          ? "PASS: booked without calendar bypass in trace"
          : "PASS: no calendar bypass (booking may still fail until workflow completes)";
  } else {
    report.callerAmy.evidence.verdict = "NO_CALL: make a live test call first";
  }

  // --- OWNER AMY ---
  const ownerReply = await ownerAsk(cookie, OWNER_SINK_QUESTION);
  const answer = String(ownerReply.data?.answer || "");
  const sources = ownerReply.data?.sources || [];
  const runtimeMode = ownerReply.data?.runtimeMode;
  const toolsUsed = ownerReply.data?.data?.toolsUsed || ownerReply.data?._runtime?.lastToolCalls || [];

  report.ownerAmy.evidence = {
    question: OWNER_SINK_QUESTION,
    answer: answer.slice(0, 2000),
    sources,
    runtimeMode,
    toolsUsed,
    data: ownerReply.data?.data,
  };

  const usedSearch =
    toolsUsed.some((t) =>
      ["search_calls", "search_agent_activity", "search_failures"].includes(t),
    ) || sources.some((s) => /search|trace|execution/i.test(String(s)));
  const genericFallback =
    /did not match a specific tool query/i.test(answer) ||
    /limited fallback mode/i.test(answer);
  const hasEvidence =
    /call|book|appointment|sink|leak|trace/i.test(answer) && !genericFallback;

  report.ownerAmy.pass = !genericFallback && (usedSearch || hasEvidence) && runtimeMode !== "limited_fallback";

  // --- WORKFLOW ARCHITECT (via Owner Amy → workflow draft) ---
  const archReply = await ownerAsk(cookie, ARCHITECT_FIELD_QUESTION);
  const archAnswer = String(archReply.data?.answer || "");
  const archTools = archReply.data?.data?.toolsUsed || archReply.data?._runtime?.lastToolCalls || [];
  const drafts = await control(cookie, "list_workflow_drafts");

  report.workflowArchitect.evidence = {
    question: ARCHITECT_FIELD_QUESTION,
    answer: archAnswer.slice(0, 2500),
    toolsUsed: archTools,
    workflowDraftId: archReply.data?.workflowDraftId,
    proposalId: archReply.data?.proposalId,
    drafts: drafts.data?.drafts || drafts.data,
    data: archReply.data?.data,
  };

  const hasWorkflowDraft =
    Boolean(archReply.data?.workflowDraftId) ||
    (drafts.data?.drafts || drafts.data || []).some(
      (d) =>
        /property type/i.test(d.name || "") ||
        /property type/i.test(d.sourceRequest || ""),
    );
  const hasFldProperty =
    JSON.stringify(archReply.data || {}).includes("fld_property_type") ||
    JSON.stringify(drafts.data || {}).includes("fld_property_type");
  const brokenProposal =
    /collectionFields\.undefined/i.test(JSON.stringify(archReply.data || {})) ||
    archAnswer.includes("collectionFields.undefined");

  report.workflowArchitect.pass =
    hasWorkflowDraft && !brokenProposal && (hasFldProperty || /workflow draft|candidate/i.test(archAnswer));

  report.finishedAt = new Date().toISOString();
  report.summary = {
    CALLER_AMY: report.callerAmy.pass ? "PASS" : "FAIL",
    OWNER_AMY: report.ownerAmy.pass ? "PASS" : "FAIL",
    WORKFLOW_ARCHITECT: report.workflowArchitect.pass ? "PASS" : "FAIL",
  };

  console.log(JSON.stringify(report, null, 2));
  const allPass = Object.values(report.summary).every((v) => v === "PASS");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
