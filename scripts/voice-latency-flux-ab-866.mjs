/**
 * Opt-in Deepgram Flux A/B for the live +1866 test receptionist.
 * Snapshots current STT/endpointing into rollbackSnapshot, applies Flux eager EOT,
 * publishes, and prints how to roll back.
 *
 * Does NOT migrate other agents.
 *
 * Usage:
 *   node scripts/voice-latency-flux-ab-866.mjs
 *   node scripts/voice-latency-flux-ab-866.mjs --rollback
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const ROLLBACK = process.argv.includes("--rollback");

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
    console.error("login failed", login);
    process.exit(1);
  }
  console.log("OK  login", login.workspaceName);

  const nums = await api(jar, "/api/numbers");
  const list = nums.json?.data || [];
  const phone =
    list.find((n) => (n.number || n.e164) === PHONE_E164) ||
    list.find((n) => String(n.number || n.e164).includes("8663464256"));
  if (!phone?.id) {
    console.error("phone not found", PHONE_E164);
    process.exit(1);
  }
  console.log("OK  phone", phone.number || phone.e164, phone.id);

  const agents = await api(jar, "/api/voice/agents");
  const agent =
    (agents.json?.data || []).find((a) => a.phoneNumberId === phone.id) ||
    (agents.json?.data || []).find((a) =>
      /main office appointment receptionist/i.test(String(a.name || "")),
    );
  if (!agent?.id) {
    console.error("agent for phone not found");
    process.exit(1);
  }
  console.log("OK  agent", agent.name, agent.id);

  const before = await api(jar, `/api/voice/agents/${agent.id}/latency-profile`);
  console.log(
    "BEFORE",
    JSON.stringify(
      {
        activeProfile: before.json?.data?.activeProfile,
        stt: before.json?.data?.transcription?.sttModel,
        endpointingMs: before.json?.data?.endpointingMs,
        bargeIn: before.json?.data?.bargeIn,
        hasRollback: before.json?.data?.hasRollbackSnapshot,
      },
      null,
      2,
    ),
  );

  const actionBody = ROLLBACK
    ? { action: "rollback", publish: true }
    : {
        action: "apply",
        profileId: "flux_eager_low_latency",
        publish: true,
      };

  const applied = await api(jar, `/api/voice/agents/${agent.id}/latency-profile`, {
    method: "POST",
    body: actionBody,
  });
  if (!applied.res.ok) {
    console.error("FAIL apply/rollback", applied.status, JSON.stringify(applied.json).slice(0, 800));
    // Fallback: PATCH draft directly if route not deployed yet
    if (applied.status === 404 && !ROLLBACK) {
      console.log("Route missing on deploy — applying via draft PATCH fallback");
      const loaded = await api(jar, `/api/voice/agents/${agent.id}`);
      const draft = loaded.json?.data?.draftConfig || {};
      const rollbackSnapshot = {
        capturedAt: new Date().toISOString(),
        fromProfile: draft.voiceTiming?.activeProfile || "legacy_cascade",
        fields: {
          transcription: { ...(draft.transcription || {}) },
          voiceLanguage: {
            endpointingMs: draft.voiceLanguage?.endpointingMs,
            silenceTimeoutMs: draft.voiceLanguage?.silenceTimeoutMs,
            bargeIn: draft.voiceLanguage?.bargeIn,
          },
        },
      };
      const nextDraft = {
        ...draft,
        transcription: {
          ...(draft.transcription || {}),
          enabled: true,
          sttProvider: "deepgram",
          sttModel: "deepgram/flux",
          language: draft.transcription?.language || "en",
          settings: {
            eot_threshold: 0.8,
            eager_eot_threshold: 0.4,
          },
        },
        voiceLanguage: {
          ...(draft.voiceLanguage || {}),
          endpointingMs: 100,
          bargeIn: draft.voiceLanguage?.bargeIn !== false,
        },
        voiceTiming: {
          ...(draft.voiceTiming || {}),
          activeProfile: "flux_eager_low_latency",
          experimental: true,
          rollbackSnapshot,
        },
      };
      const patched = await api(jar, `/api/voice/agents/${agent.id}`, {
        method: "PATCH",
        body: { draftConfig: nextDraft },
      });
      console.log("PATCH", patched.status, patched.res.ok);
      const pub = await api(jar, `/api/voice/agents/${agent.id}`, {
        method: "PATCH",
        body: { action: "publish" },
      });
      console.log(
        "PUBLISH",
        pub.status,
        pub.res.ok,
        JSON.stringify(pub.json).slice(0, 400),
      );
    } else {
      process.exit(1);
    }
  } else {
    console.log("OK  profile action", JSON.stringify(applied.json?.data, null, 2).slice(0, 1200));
  }

  const after = await api(jar, `/api/voice/agents/${agent.id}`);
  const cfg = after.json?.data?.draftConfig || {};
  console.log(
    "AFTER",
    JSON.stringify(
      {
        name: after.json?.data?.name,
        status: after.json?.data?.status,
        telnyxAssistantId: after.json?.data?.telnyxAssistantId,
        sttModel: cfg.transcription?.sttModel,
        settings: cfg.transcription?.settings,
        endpointingMs: cfg.voiceLanguage?.endpointingMs,
        bargeIn: cfg.voiceLanguage?.bargeIn,
        voiceId: cfg.voiceLanguage?.voiceId,
        modelId: cfg.model?.modelId,
        activeProfile: cfg.voiceTiming?.activeProfile,
        hasRollback: Boolean(cfg.voiceTiming?.rollbackSnapshot),
      },
      null,
      2,
    ),
  );

  console.log(
    ROLLBACK
      ? "\nRolled back to previous snapshot. Call +1 (866) 346-4256 to verify legacy behavior."
      : "\nFlux A/B applied to Main Office Appointment Receptionist on +18663464256.\nCall that number to test.\nRollback: node scripts/voice-latency-flux-ab-866.mjs --rollback",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
