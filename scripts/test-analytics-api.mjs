/**
 * Smoke test analytics APIs.
 * Run: CONTACTS_TEST_URL=http://localhost:3000 node scripts/test-analytics-api.mjs
 */
const BASE = (process.env.CONTACTS_TEST_URL || "http://localhost:3000").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = process.env.SMOKE_EMAIL || "alex@harborhome.co";
const WORKSPACE_ID = process.env.SMOKE_WORKSPACE_ID || "ws_1";

const jar = new Map();

function parseSetCookie(headers) {
  for (const raw of headers.getSetCookie?.() || []) {
    const part = raw.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

async function api(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  const cookies = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookies) headers.set("Cookie", cookies);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  parseSetCookie(res.headers);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, json };
}

const failures = [];
function check(name, cond, detail = "") {
  if (!cond) failures.push({ name, detail });
  console.log(cond ? "PASS" : "FAIL", name, detail);
}

async function main() {
  const login = await api("/api/auth/smoke-login", {
    method: "POST",
    headers: { "x-smoke-bootstrap": BOOTSTRAP },
    body: JSON.stringify({ email: EMAIL, workspaceId: WORKSPACE_ID }),
  });
  check("smoke-login", login.ok, `status ${login.status}`);
  if (!login.ok) process.exit(1);

  const sms = await api("/api/sms/analytics?days=30");
  check(
    "GET sms/analytics",
    sms.ok && sms.json?.data?.kpis && Array.isArray(sms.json?.data?.timeSeries),
    `sent=${sms.json?.data?.kpis?.messagesSent}`,
  );
  check(
    "sms audience topLists shape",
    sms.ok && Array.isArray(sms.json?.data?.audience?.topLists),
    `lists=${sms.json?.data?.audience?.topLists?.length}`,
  );

  const smsCompare = await api("/api/sms/analytics?days=7&compare=1");
  check(
    "GET sms/analytics compare",
    smsCompare.ok && smsCompare.json?.data?.compareKpis != null,
    `compareSent=${smsCompare.json?.data?.compareKpis?.messagesSent}`,
  );

  const messaging = await api("/api/analytics/messaging?days=30");
  check(
    "GET analytics/messaging",
    messaging.ok && messaging.json?.data?.kpis,
    `sent=${messaging.json?.data?.kpis?.messagesSent}`,
  );

  const dashboard = await api("/api/sms/dashboard/activity?days=30");
  check(
    "GET sms/dashboard/activity",
    dashboard.ok && Array.isArray(dashboard.json?.data?.series),
    `points=${dashboard.json?.data?.series?.length}`,
  );

  const mctb = await api("/api/mctb/analytics?range=30d");
  check(
    "GET mctb/analytics",
    mctb.ok && mctb.json?.data?.range === "30d",
    `missed=${mctb.json?.data?.totalMissed}`,
  );

  const mctbBad = await api("/api/mctb/analytics?range=invalid");
  check(
    "mctb invalid range defaults",
    mctbBad.ok && mctbBad.json?.data?.range === "30d",
    mctbBad.json?.data?.range,
  );

  const sr = await api("/api/smart-routing/analytics?days=30");
  check(
    "GET smart-routing/analytics",
    sr.ok && typeof sr.json?.data?.callsRouted === "number",
    `routed=${sr.json?.data?.callsRouted}`,
  );
  check(
    "SR analytics has byFlow",
    sr.ok && sr.json?.data?.byFlow && typeof sr.json?.data?.byFlow === "object",
    "ok",
  );

  const reports = await api("/api/reports/summary");
  check(
    "GET reports/summary",
    reports.ok && reports.json?.data?.metrics,
    `contacts=${reports.json?.data?.metrics?.contactGrowth}`,
  );

  const integrations = await api("/api/reports/integrations");
  check("GET reports/integrations", integrations.ok, "ok");

  const personal = await api("/api/personal/analytics?days=30");
  check(
    "GET personal/analytics",
    personal.ok && typeof personal.json?.data?.totalCalls === "number",
    `calls=${personal.json?.data?.totalCalls}`,
  );

  console.log(`\nFailures: ${failures.length}`);
  if (failures.length) {
    for (const f of failures) console.log("-", f.name, f.detail);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
