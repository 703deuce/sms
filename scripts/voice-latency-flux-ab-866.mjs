/**
 * Opt-in latency A/B/C for the live +1866 test receptionist.
 *
 * VERSION A — legacy_cascade (baseline / rollback)
 * VERSION B — flux_eager_low_latency (Flux + eager EOT + 0.1s plan + Haiku + Ultra)
 * VERSION C — native_audio_ultravox (experiment)
 *
 * Snapshots current provider fields into rollbackSnapshot, applies profile,
 * publishes, and prints how to roll back. Does NOT migrate other agents.
 *
 * Usage:
 *   node scripts/voice-latency-flux-ab-866.mjs
 *   node scripts/voice-latency-flux-ab-866.mjs --profile B
 *   node scripts/voice-latency-flux-ab-866.mjs --profile C
 *   node scripts/voice-latency-flux-ab-866.mjs --rollback
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const ROLLBACK = process.argv.includes("--rollback");

const PROFILE_FLAG_IDX = process.argv.indexOf("--profile");
const PROFILE_ARG =
  PROFILE_FLAG_IDX >= 0 ? String(process.argv[PROFILE_FLAG_IDX + 1] || "B").toUpperCase() : "B";

const PROFILE_BY_VERSION = {
  A: "legacy_cascade",
  B: "flux_eager_low_latency",
  C: "native_audio_ultravox",
};

const PROFILE_ID =
  PROFILE_BY_VERSION[PROFILE_ARG] ||
  (["legacy_cascade", "flux_eager_low_latency", "native_audio_ultravox"].includes(PROFILE_ARG)
    ? PROFILE_ARG
    : "flux_eager_low_latency");

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
        versionLabel: before.json?.data?.versionLabel,
        stt: before.json?.data?.transcription?.sttModel,
        endpointingMs: before.json?.data?.endpointingMs,
        bargeIn: before.json?.data?.bargeIn,
        modelId: before.json?.data?.modelId,
        voiceId: before.json?.data?.voiceId,
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
        profileId: PROFILE_ID,
        publish: true,
      };

  console.log(
    ROLLBACK ? "Applying rollback…" : `Applying Version ${PROFILE_ARG} (${PROFILE_ID})…`,
  );

  const applied = await api(jar, `/api/voice/agents/${agent.id}/latency-profile`, {
    method: "POST",
    body: actionBody,
  });
  if (!applied.res.ok) {
    console.error("FAIL apply/rollback", applied.status, JSON.stringify(applied.json).slice(0, 800));
    if (applied.status === 404 && !ROLLBACK && PROFILE_ID === "flux_eager_low_latency") {
      console.log("Route missing on deploy — applying Version B via draft PATCH fallback");
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
          voiceId: draft.voiceLanguage?.voiceId,
          speed: draft.voiceLanguage?.speed,
          modelId: draft.model?.modelId,
          greeting: draft.callHandling?.greeting,
        },
      };
      const keepUltra =
        /ultra/i.test(String(draft.voiceLanguage?.voiceId || "")) ||
        String(draft.voiceLanguage?.voiceId || "").startsWith("Telnyx.Ultra.");
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
            eot_timeout_ms: 5000,
          },
        },
        voiceLanguage: {
          ...(draft.voiceLanguage || {}),
          voiceId: keepUltra ? draft.voiceLanguage.voiceId : "allie-ultra",
          endpointingMs: 100,
          bargeIn: draft.voiceLanguage?.bargeIn !== false,
        },
        model: {
          ...(draft.model || {}),
          modelId: "anthropic/claude-haiku-4-5",
        },
        callHandling: {
          ...(draft.callHandling || {}),
          greeting:
            draft.callHandling?.greeting ||
            "Thanks for calling. How can I help you today?",
        },
        voiceTiming: {
          ...(draft.voiceTiming || {}),
          activeProfile: "flux_eager_low_latency",
          experimental: true,
          rollbackSnapshot,
          diagnostics: {
            versionLabel: "B",
            ordinaryTurnPrimaryGoalMs: 500,
            metric: "caller_end_of_speech_to_first_audible_agent_audio",
            startSpeakingPlan: {
              waitSeconds: 0.1,
              onPunctuationSeconds: 0.1,
              onNoPunctuationSeconds: 1.0,
              onNumberSeconds: 1.0,
            },
            note: "Do not claim sub-500ms until real telephone measurements confirm it.",
          },
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
    console.log("OK  profile action", JSON.stringify(applied.json?.data, null, 2).slice(0, 1600));
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
        greeting: cfg.callHandling?.greeting,
        activeProfile: cfg.voiceTiming?.activeProfile,
        startSpeakingPlan: cfg.voiceTiming?.diagnostics?.startSpeakingPlan,
        hasRollback: Boolean(cfg.voiceTiming?.rollbackSnapshot),
      },
      null,
      2,
    ),
  );

  console.log(
    ROLLBACK
      ? "\nRolled back to previous snapshot. Call +1 (866) 346-4256 to verify baseline (Version A)."
      : `\nLatency profile applied (${PROFILE_ID}) on Main Office Appointment Receptionist / +18663464256.\nCall that number to measure ordinary turns.\nDo not claim sub-500 ms until real telephone measurements confirm it.\nRollback: node scripts/voice-latency-flux-ab-866.mjs --rollback`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
