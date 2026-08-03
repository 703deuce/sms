/**
 * Apply Alexandra (Flash) to Phone Test Desk for live receptionist A/B.
 *
 * Voice: Alexandra kdmDKE6EkgrWrrykO9Qt
 * Model: eleven_flash_v2_5 (speed)
 * Tuning: stability 0.45, similarity 0.75, speed 1.0
 *
 * Usage: node scripts/alexandra-flash-live.mjs
 */

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const AGENT_ID = (process.env.AGENT_ID || "cmsc3nw966a414a5h722y2s64").trim();
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();

const ALEXANDRA = {
  voiceId: "kdmDKE6EkgrWrrykO9Qt",
  displayName: "Alexandra",
};
const TUNING = { stability: 0.45, similarityBoost: 0.75, speed: 1.0 };
const MODEL = (process.env.EL_MODEL || "eleven_flash_v2_5").trim();
const CATALOG_ID = `el:${MODEL}:${ALEXANDRA.voiceId}`;

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
async function api(jar, path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
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
    json = { raw: text.slice(0, 600) };
  }
  return { res, json, status: res.status };
}

function log(ok, name, note = "") {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${note ? `: ${note}` : ""}`);
}

async function main() {
  const jar = new Map();
  console.log(
    JSON.stringify(
      {
        base: BASE,
        agentId: AGENT_ID,
        phone: PHONE_E164,
        catalogId: CATALOG_ID,
        voice: ALEXANDRA.displayName,
        voiceId: ALEXANDRA.voiceId,
        model: MODEL,
        tuning: TUNING,
      },
      null,
      2,
    ),
  );

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
  log(loginRes.ok && login.ok, "smoke-login", login.workspaceName || login.error || String(loginRes.status));
  if (!loginRes.ok) process.exit(1);

  const loaded = await api(jar, `/api/voice/agents/${AGENT_ID}`);
  if (!loaded.res.ok) {
    log(false, "load agent", JSON.stringify(loaded.json).slice(0, 300));
    process.exit(1);
  }
  const agent = loaded.json.data;
  const draft = agent.draftConfig || {};
  log(
    true,
    "loaded agent",
    `${agent.name} telnyx=${agent.telnyxAssistantId || "none"} voice=${draft.voiceLanguage?.voiceId || "?"}`,
  );

  const nextDraft = {
    ...draft,
    voiceLanguage: {
      ...(draft.voiceLanguage || {}),
      voiceId: CATALOG_ID,
      voiceProvider: "elevenlabs",
      speed: TUNING.speed,
      expressiveMode: false,
      elevenLabsApiKeyRef: "elevenlabs_transovo",
      elevenLabsTuning: true,
      elevenLabsStability: TUNING.stability,
      elevenLabsSimilarityBoost: TUNING.similarityBoost,
    },
  };

  const saved = await api(jar, `/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    body: { draftConfig: nextDraft },
  });
  log(
    saved.res.ok,
    "save draft voice",
    saved.res.ok
      ? saved.json.data?.draftConfig?.voiceLanguage?.voiceId
      : JSON.stringify(saved.json).slice(0, 400),
  );
  if (!saved.res.ok) process.exit(1);

  const built = await api(jar, `/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    body: { action: "build" },
  });
  log(
    built.res.ok,
    "build",
    built.res.ok
      ? `v${built.json.version} telnyx=${built.json.telnyxAssistantId || built.json.data?.telnyxAssistantId} health=${built.json.healthStatus || built.json.data?.healthStatus}`
      : JSON.stringify(built.json).slice(0, 500),
  );
  if (!built.res.ok) process.exit(1);

  const deployed = await api(jar, `/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    body: { action: "deploy" },
  });
  log(
    deployed.res.ok,
    "deploy",
    deployed.res.ok
      ? `v${deployed.json.version} status=${deployed.json.data?.status}`
      : JSON.stringify(deployed.json).slice(0, 500),
  );
  if (!deployed.res.ok) process.exit(1);

  const after = await api(jar, `/api/voice/agents/${AGENT_ID}`);
  const vl = after.json.data?.draftConfig?.voiceLanguage || {};
  console.log(
    JSON.stringify(
      {
        phone: PHONE_E164,
        agentId: AGENT_ID,
        telnyxAssistantId: after.json.data?.telnyxAssistantId,
        voiceLanguage: {
          voiceId: vl.voiceId,
          speed: vl.speed,
          elevenLabsTuning: vl.elevenLabsTuning,
          elevenLabsStability: vl.elevenLabsStability,
          elevenLabsSimilarityBoost: vl.elevenLabsSimilarityBoost,
          elevenLabsApiKeyRef: vl.elevenLabsApiKeyRef,
        },
        healthStatus: after.json.data?.healthStatus,
        healthMessage: after.json.data?.healthMessage,
        callScript: [
          "Greet the caller",
          "Ask for their name",
          "Repeat a phone number",
          "Offer two appointment times",
          "Respond to an interruption",
          "Handle an urgent-sounding request",
        ],
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
