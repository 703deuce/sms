/**
 * Live: login to owner workspace → sync Telnyx numbers → build voice agent →
 * assign paid DID → deploy for inbound phone testing.
 */
import { randomBytes } from "crypto";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const PREFERRED_E164 = (process.env.PHONE_E164 || "").trim();

const results = [];
function log(ok, name, note = "") {
  results.push({ ok, name, note });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${note ? `: ${note}` : ""}`);
}

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
    json = { raw: text.slice(0, 400) };
  }
  return { res, json, status: res.status };
}

async function main() {
  const jar = new Map();

  // 1) Session for real owner workspace (no password reset)
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
  if (!loginRes.ok) {
    console.log(JSON.stringify({ results, login }, null, 2));
    process.exit(1);
  }
  console.log("workspaces", JSON.stringify(login.workspaces || [], null, 2));

  // 2) Sync Telnyx owned numbers into this workspace
  const sync = await api(jar, "/api/numbers/sync-telnyx", {
    method: "POST",
    body: {
      attachConnection: true,
      ...(PREFERRED_E164 ? { e164s: [PREFERRED_E164] } : {}),
    },
  });
  log(
    sync.res.ok,
    "sync-telnyx",
    sync.res.ok
      ? `telnyx=${sync.json.data?.telnyxCount} imported=${sync.json.data?.imported?.length}`
      : JSON.stringify(sync.json).slice(0, 300),
  );
  if (sync.res.ok) {
    console.log(
      "imported detail",
      JSON.stringify(sync.json.data?.imported || [], null, 2).slice(0, 2000),
    );
  }

  // 3) List workspace numbers
  const nums = await api(jar, "/api/numbers");
  const list = nums.json?.data || [];
  log(nums.res.ok && list.length > 0, "workspace numbers", list.map((n) => n.number || n.e164).join(", ") || "none");
  if (!list.length) {
    console.log(JSON.stringify({ results, sync: sync.json }, null, 2));
    process.exit(1);
  }

  let phone = list[0];
  if (PREFERRED_E164) {
    phone =
      list.find((n) => (n.number || n.e164) === PREFERRED_E164) ||
      list.find((n) => String(n.number || n.e164).includes(PREFERRED_E164.replace(/\D/g, "").slice(-10))) ||
      phone;
  }
  const phoneNumberId = phone.id;
  const e164 = phone.number || phone.e164;
  log(!!phoneNumberId, "selected number", `${e164} (${phoneNumberId})`);

  // 4) Create or reuse a phone-test agent
  const stamp = randomBytes(3).toString("hex");
  const agents = await api(jar, "/api/voice/agents");
  let agent =
    (agents.json?.data || []).find((a) =>
      /phone test|webrtc|front desk/i.test(String(a.name || "")),
    ) || null;

  if (!agent) {
    const created = await api(jar, "/api/voice/agents", {
      method: "POST",
      body: {
        name: `Phone Test Desk ${stamp}`,
        agentType: "receptionist",
        description: "Inbound phone test agent",
      },
    });
    agent = created.json?.data;
    log(created.status === 201 && !!agent?.id, "create agent", agent?.id || JSON.stringify(created.json).slice(0, 200));
  } else {
    log(true, "reuse agent", `${agent.name} ${agent.id}`);
  }
  if (!agent?.id) process.exit(1);

  // 5) Configure + assign number
  const loaded = await api(jar, `/api/voice/agents/${agent.id}`);
  const draft = loaded.json?.data?.draftConfig || {};
  const nextDraft = {
    ...draft,
    identity: { ...(draft.identity || {}), directions: ["inbound"] },
    callHandling: {
      ...(draft.callHandling || {}),
      greeting:
        "Hi, thanks for calling. This is the Transovo voice agent. How can I help you today?",
    },
    instructions: {
      ...(draft.instructions || {}),
      role: "friendly front-desk receptionist",
      system:
        "You are the front desk. Be brief and warm. Answer hours (9am-5pm Mon-Fri), take a message, or help with common questions. Never invent appointments.",
      tone: "warm",
      style: "concise",
    },
    voiceLanguage: {
      ...(draft.voiceLanguage || {}),
      voiceId: "ava-warm-us",
      primaryLanguage: "en-US",
      bargeIn: true,
      speed: 1,
    },
  };

  const saved = await api(jar, `/api/voice/agents/${agent.id}`, {
    method: "PATCH",
    body: {
      name: loaded.json?.data?.name || agent.name,
      purpose: "Inbound phone + browser voice test",
      phoneNumberId,
      draftConfig: nextDraft,
    },
  });
  log(saved.res.ok, "save + assign number", saved.json?.error || saved.status);

  // 6) Build then Deploy
  const built = await api(jar, `/api/voice/agents/${agent.id}`, {
    method: "PATCH",
    body: { action: "build_for_test" },
  });
  log(
    built.res.ok,
    "build_for_test",
    built.res.ok
      ? `assistant=${built.json?.data?.agent?.telnyxAssistantId || built.json?.data?.telnyxAssistantId || "?"}`
      : JSON.stringify(built.json).slice(0, 300),
  );

  const enable = await api(jar, "/api/voice/ai", {
    method: "POST",
    body: { action: "enable_web_calls", agentId: agent.id },
  });
  log(
    enable.res.ok && enable.json?.data?.webCallsEnabled !== false,
    "enable_web_calls",
    JSON.stringify(enable.json?.data || enable.json).slice(0, 220),
  );

  const deployed = await api(jar, `/api/voice/agents/${agent.id}`, {
    method: "PATCH",
    body: { action: "deploy" },
  });
  log(
    deployed.res.ok,
    "deploy",
    deployed.res.ok
      ? `status=${deployed.json?.data?.agent?.status || deployed.json?.data?.rawStatus || "ok"}`
      : JSON.stringify(deployed.json).slice(0, 400),
  );

  const after = await api(jar, `/api/voice/agents/${agent.id}`);
  const final = after.json?.data;
  log(
    String(final?.rawStatus || final?.status).toUpperCase() === "ACTIVE" &&
      final?.phoneNumberId === phoneNumberId &&
      !!final?.telnyxAssistantId,
    "agent active on number",
    `status=${final?.rawStatus || final?.status} phone=${final?.phoneNumberId} assistant=${final?.telnyxAssistantId}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        base: BASE,
        email: OWNER_EMAIL,
        workspaceId: login.workspaceId,
        agentId: agent.id,
        agentName: final?.name || agent.name,
        e164,
        phoneNumberId,
        telnyxAssistantId: final?.telnyxAssistantId,
        status: final?.rawStatus || final?.status,
        callThisNumber: e164,
        failed: failed.map((f) => ({ name: f.name, note: f.note })),
        pass: failed.length === 0,
      },
      null,
      2,
    ),
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
