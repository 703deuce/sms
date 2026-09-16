/**
 * Assign ws_1 designated 571 test DID to Voice Agent wizard agent via API (no UI).
 * Does not place PSTN calls.
 *
 *   BASE_URL=... AGENT_ID=... PHONE_E164=... node scripts/wizard-571-voice-line-api-setup.mjs
 */
const BASE = (process.env.BASE_URL || "").replace(/\/$/, "");
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_E164 = (process.env.PHONE_E164 || "").trim();
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";

function last4(e164) {
  const d = String(e164 || "").replace(/\D/g, "");
  return d.slice(-4);
}

async function smokeLogin() {
  const res = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: EMAIL, workspaceId: "ws_1" }),
  });
  const cookies = res.headers.getSetCookie?.() || [];
  const jar = cookies.map((c) => c.split(";")[0]).join("; ");
  const json = await res.json();
  if (!res.ok) throw new Error(`smoke-login: ${JSON.stringify(json)}`);
  return jar;
}

async function api(cookie, path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { res, json };
}

async function main() {
  if (!BASE) throw new Error("BASE_URL required");
  if (!PHONE_E164) throw new Error("PHONE_E164 required (571 test DID)");

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  const cookie = await smokeLogin();

  const nums = await api(cookie, "/api/numbers");
  const list = nums.json?.data || [];
  const phone =
    list.find((n) => (n.number || n.e164) === PHONE_E164) ||
    list.find((n) => String(n.number || n.e164).includes(last4(PHONE_E164)));
  if (!phone?.id) {
    console.error(JSON.stringify({ error: "phone_not_in_workspace", PHONE_E164, count: list.length }));
    process.exit(1);
  }

  const setupGet = await api(
    cookie,
    `/api/solutions/appointment-receptionist?agentId=${AGENT_ID}`,
  );
  const state = setupGet.json?.data?.state || {};
  const nextState = {
    ...state,
    agentId: AGENT_ID,
    phoneNumberId: phone.id,
    phoneNumberE164: phone.number || phone.e164 || PHONE_E164,
    numberSource: "transovo",
  };

  const save = await api(cookie, "/api/solutions/appointment-receptionist", {
    method: "POST",
    body: {
      action: "save_draft",
      state: nextState,
      wizardStepId: "phone",
    },
  });
  if (!save.res.ok) {
    console.error(JSON.stringify({ step: "save_draft", status: save.res.status, body: save.json }));
    process.exit(1);
  }

  const patch = await api(cookie, "/api/mctb/inbound-handling", {
    method: "PATCH",
    body: {
      mode: "VOICE_AGENT",
      phoneNumberId: phone.id,
      voiceAgentId: AGENT_ID,
    },
  });
  if (!patch.res.ok) {
    console.error(JSON.stringify({ step: "inbound-handling", status: patch.res.status, body: patch.json }));
    process.exit(1);
  }

  const agent = await api(cookie, `/api/voice/agents/${AGENT_ID}`);
  const inbound = await api(
    cookie,
    `/api/mctb/inbound-handling?phoneNumberId=${encodeURIComponent(phone.id)}`,
  );

  const line = inbound.json?.data?.line;
  const a = agent.json?.data;

  const report = {
    healthSha: health.commitSha,
    agentId: AGENT_ID,
    phoneLast4: last4(phone.number || phone.e164),
    phoneNumberId: phone.id,
    inboundHandlingMode: line?.inboundHandlingMode,
    voiceAgentId: line?.voiceAgentId,
    voiceTexmlAppId: line?.voiceTexmlAppId,
    agentStatus: a?.rawStatus || a?.status,
    telnyxAssistantId: a?.telnyxAssistantId ? "set" : "missing",
    publishedVersionId: a?.publishedVersionId,
    telephonyPath: patch.json?.data?.telephonyPath,
    ok:
      line?.inboundHandlingMode === "VOICE_AGENT" &&
      line?.voiceAgentId === AGENT_ID &&
      Boolean(a?.telnyxAssistantId),
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
