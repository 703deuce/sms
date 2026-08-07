/**
 * Pull detailed call logs for Amy post-call investigation.
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const CALL_ID = process.env.CALL_ID || "cmsi8r1z50y2e6p183r1t4619";

async function smokeLogin() {
  const res = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: "703deuce@gmail.com", workspaceId: "ws_1" }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  const setCookie = res.headers.getSetCookie?.() || [];
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function control(cookie, command, payload = {}) {
  const res = await fetch(`${BASE}/api/agents/${AGENT_ID}/control`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ command, payload }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json.data, error: json.error };
}

async function main() {
  const cookie = await smokeLogin();

  const activity = await control(cookie, "search_agent_activity", { limit: 5 });
  const traces = activity.data?.traces || [];
  const callId = CALL_ID || traces[0]?.callId;

  const out = {
    callId,
    latestTraces: traces,
    executionTrace: null,
    timeline: null,
    explainFailure: null,
    bookingVerification: null,
    health: null,
    talkLastCall: null,
    talkCalendar: null,
  };

  if (callId) {
    out.executionTrace = (await control(cookie, "get_execution_trace", { callId })).data;
    out.timeline = (await control(cookie, "get_employee_timeline", { callId })).data;
    out.explainFailure = (await control(cookie, "explain_call_failure", { callId })).data;
    out.bookingVerification = (await control(cookie, "get_booking_verification", { callId })).data;
  }

  out.health = (await control(cookie, "get_agent_health")).data;
  out.talkLastCall = (await control(cookie, "owner_ask", {
    question: "What happened on the last call?",
  })).data;
  out.talkCalendar = (await control(cookie, "owner_ask", {
    question: "Why didn't the calendar work on the last call?",
  })).data;

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
