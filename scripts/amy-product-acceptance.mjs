/**
 * Amy product acceptance — proves UI/control surfaces hit real records.
 * Live PSTN booking still needs a human call after Coolify deploy.
 *
 *   BASE_URL=https://transovo.ai node scripts/amy-product-acceptance.mjs
 */
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const OUT = "/opt/cursor/artifacts/amy-lifecycle/product-acceptance.json";

let cookie = "";
const report = {
  at: new Date().toISOString(),
  base: BASE,
  agentId: AGENT_ID,
  steps: [],
  ok: false,
};

function step(id, ok, detail) {
  report.steps.push({ id, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${id}`, typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 180));
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
      cookie,
      ...(opts.headers || {}),
    },
  });
  const setCookie =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (setCookie.length) {
    const map = new Map(
      cookie
        .split("; ")
        .filter(Boolean)
        .map((p) => {
          const i = p.indexOf("=");
          return [p.slice(0, i), p.slice(i + 1)];
        }),
    );
    for (const c of setCookie) {
      const part = c.split(";")[0];
      const i = part.indexOf("=");
      map.set(part.slice(0, i), part.slice(i + 1));
    }
    cookie = [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function control(command, payload = {}) {
  return api(`/api/agents/${AGENT_ID}/control`, {
    method: "POST",
    body: JSON.stringify({ command, payload }),
  });
}

async function main() {
  const login = await api("/api/auth/smoke-login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL }),
  });
  step("smoke-login", login.status === 200, login.json);

  const agent = await api(`/api/agents/${AGENT_ID}`);
  const view = agent.json?.data;
  step(
    "load-agent",
    agent.status === 200 && Boolean(view?.metrics?.today),
    {
      status: view?.identity?.status,
      health: view?.health?.overall,
      todayCalls: view?.metrics?.today?.callsAnswered,
      autonomy: view?.autonomyMode,
    },
  );

  for (const command of [
    "get_setup_readiness",
    "get_deployment_drift",
    "get_runtime_registry",
    "get_attention_inbox",
    "get_daily_report",
    "get_memory_view",
    "get_autonomy_policy",
    "list_agent_appointments",
    "search_agent_activity",
  ]) {
    const r = await control(command, { limit: 5 });
    step(`control:${command}`, r.status === 200, {
      status: r.status,
      keys: Object.keys(r.json?.data || {}).slice(0, 8),
      error: r.json?.error,
    });
  }

  const runtimes = await control("get_runtime_registry");
  const ids = (runtimes.json?.data?.runtimes || []).map((r) => r.id);
  step(
    "four-runtimes",
    ["caller_amy", "owner_amy", "appointment_workflow_architect", "diagnostic_specialist"].every(
      (id) => ids.includes(id),
    ),
    ids,
  );

  const buckets = runtimes.json?.data;
  const autonomy = await control("get_autonomy_policy");
  step(
    "autonomy-buckets",
    Boolean(autonomy.json?.data?.buckets?.mayAlways?.length) &&
      Boolean(autonomy.json?.data?.buckets?.neverAllowed?.length),
    autonomy.json?.data?.buckets
      ? Object.fromEntries(
          Object.entries(autonomy.json.data.buckets).map(([k, v]) => [k, (v || []).length]),
        )
      : autonomy.json?.error,
  );

  const ask = await control("owner_ask", {
    question: "What happened on the last call?",
  });
  step("talk-last-call", ask.status === 200 && Boolean(ask.json?.data?.answer), {
    answer: String(ask.json?.data?.answer || "").slice(0, 220),
    evidence: ask.json?.data?.evidence,
  });

  const howToday = await control("owner_ask", { question: "How did today go?" });
  step("talk-today", howToday.status === 200, String(howToday.json?.data?.answer || "").slice(0, 200));

  const propose = await control("owner_ask", {
    question: "Require an email for this service",
  });
  step(
    "talk-propose-email",
    propose.status === 200 &&
      (Boolean(propose.json?.data?.proposalId) ||
        /proposal|draft|require/i.test(String(propose.json?.data?.answer || ""))),
    {
      proposalId: propose.json?.data?.proposalId,
      answer: String(propose.json?.data?.answer || "").slice(0, 220),
    },
  );

  const testSelf = await control("owner_ask", { question: "Test yourself" });
  step(
    "talk-test-yourself",
    testSelf.status === 200 && /simulation|test suite/i.test(String(testSelf.json?.data?.answer || "")),
    String(testSelf.json?.data?.answer || "").slice(0, 240),
  );

  report.ok = report.steps.filter((s) => !s.ok).length === 0;
  fs.mkdirSync("/opt/cursor/artifacts/amy-lifecycle", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(report.ok ? "\nACCEPTANCE API SURFACE OK" : "\nACCEPTANCE HAS FAILURES");
  console.log("Wrote", OUT);
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
