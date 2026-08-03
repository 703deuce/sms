/**
 * Enable Transovo default connection greeting on Phone Test Desk and rebuild.
 *
 * Usage: node scripts/enable-connection-greeting.mjs [off|on]
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const AGENT_ID = (process.env.AGENT_ID || "cmsc3nw966a414a5h722y2s64").trim();
const MODE = (process.argv[2] || "on").toLowerCase();

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(jar, res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
async function api(jar, pathName, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(jar),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 800) };
  }
  return { res, json, status: res.status };
}

async function main() {
  const jar = new Map();
  const loginRes = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: OWNER_EMAIL }),
  });
  storeCookies(jar, loginRes);
  const login = await loginRes.json();
  if (!loginRes.ok || !login.ok) {
    throw new Error(`smoke-login failed: ${JSON.stringify(login).slice(0, 300)}`);
  }

  const loaded = await api(jar, `/api/voice/agents/${AGENT_ID}`);
  const agent = loaded.json?.data;
  if (!loaded.res.ok || !agent) {
    throw new Error(`load agent failed: ${JSON.stringify(loaded.json).slice(0, 400)}`);
  }

  const draft = agent.draftConfig || {};
  const callHandling = { ...(draft.callHandling || {}) };
  const startupGreeting = { ...(callHandling.startupGreeting || {}) };

  if (MODE === "off") {
    startupGreeting.connectionGreeting = "off";
    startupGreeting.mode = "ai";
    startupGreeting.enabled = true;
  } else {
    startupGreeting.connectionGreeting = "transovo_default";
    startupGreeting.mode = "transovo_default";
    startupGreeting.enabled = true;
    // Concurrent: play bed while AI initializes — do not wait out the clip.
    startupGreeting.delayMs = 0;
    startupGreeting.handOffWhenReady = true;
    // Clear any stale override so hosted Transovo asset is used after deploy.
    startupGreeting.audioUrl = "";
  }
  callHandling.startupGreeting = startupGreeting;

  const saved = await api(jar, `/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    body: {
      draftConfig: {
        ...draft,
        callHandling,
      },
    },
  });
  if (!saved.res.ok) {
    throw new Error(`save failed: ${JSON.stringify(saved.json).slice(0, 500)}`);
  }

  const built = await api(jar, `/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    body: { action: "build" },
  });
  if (!built.res.ok) {
    throw new Error(`build failed: ${JSON.stringify(built.json).slice(0, 500)}`);
  }

  const deployed = await api(jar, `/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    body: { action: "deploy" },
  });
  if (!deployed.res.ok) {
    throw new Error(`deploy failed: ${JSON.stringify(deployed.json).slice(0, 500)}`);
  }

  // Phone Test Desk must answer with AI immediately (not human-first ring).
  // A human-first rule with no staff online yields "cannot be completed as dialed".
  const rulesRes = await api(jar, "/api/voice/routing");
  const agentRules = (rulesRes.json?.data || []).filter((r) => r.agentId === AGENT_ID);
  const hasBad = agentRules.some(
    (r) => r.actions?.type === "human_first" || r.actions?.type === "ai_after_hours",
  );
  const hasAi = agentRules.some((r) => r.actions?.type === "ai_answer");
  if (hasBad || !hasAi) {
    for (const r of agentRules) {
      await api(jar, `/api/voice/routing/${r.id}`, { method: "DELETE" });
    }
    await api(jar, "/api/voice/routing", {
      method: "POST",
      body: {
        name: "Phone Test Desk: AI answer always",
        agentId: AGENT_ID,
        priority: 1,
        conditions: { flowManaged: true, forceAiAnswer: true },
        actions: { type: "ai_answer", agentId: AGENT_ID },
      },
    });
  }

  const rulesAfter = await api(jar, "/api/voice/routing");
  const finalRules = (rulesAfter.json?.data || [])
    .filter((r) => r.agentId === AGENT_ID)
    .map((r) => ({ name: r.name, type: r.actions?.type, priority: r.priority }));

  console.log(
    JSON.stringify(
      {
        mode: MODE,
        connectionGreeting: startupGreeting.connectionGreeting,
        startupMode: startupGreeting.mode,
        saveOk: saved.res.ok,
        buildOk: built.res.ok,
        deployOk: deployed.res.ok,
        buildVersion: built.json.version || built.json.data?.version,
        health: built.json.healthStatus || built.json.data?.healthStatus,
        savedStartup:
          saved.json?.data?.draftConfig?.callHandling?.startupGreeting,
        routing: finalRules,
        audioUrl:
          "https://transovo.ai/connection-greeting/transovo-connection-greeting-phone.mp3",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
