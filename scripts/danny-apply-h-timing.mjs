/**
 * Apply official ULL H/F aggressive Flux timing to production Danny
 * (keeps tools / prompt / Haiku / Allie Ultra). Restores DID routing to Danny.
 *
 * Usage:
 *   node scripts/danny-apply-h-timing.mjs
 *   node scripts/danny-apply-h-timing.mjs --timing aggressive
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com")
  .trim()
  .toLowerCase();
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const OUT_DIR =
  process.env.BASELINE_OUT || "/opt/cursor/artifacts/danny-agent";
const TIMING_IDX = process.argv.indexOf("--timing");
const TIMING =
  TIMING_IDX >= 0
    ? String(process.argv[TIMING_IDX + 1] || "aggressive").trim()
    : "aggressive";

const AGGRESSIVE = {
  eot_threshold: 0.7,
  eager_eot_threshold: 0.3,
  eot_timeout_ms: 3000,
  wait_seconds: 0.05,
};

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
async function api(jar, path, { method = "GET", body, bootstrap = false } = {}) {
  const headers = {
    "content-type": "application/json",
    cookie: cookieHeader(jar),
  };
  if (bootstrap) headers["x-smoke-bootstrap"] = BOOTSTRAP;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 1200) };
  }
  return { res, json, status: res.status, ok: res.ok };
}

function save(name, data) {
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    const path = join(OUT_DIR, name);
    writeFileSync(path, JSON.stringify(data, null, 2));
    console.log("saved", path);
  } catch (err) {
    console.warn("save failed", name, err instanceof Error ? err.message : err);
  }
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
  console.log("OK login", login.workspaceName);

  const agents = await api(jar, "/api/voice/agents");
  const agent =
    (agents.json?.data || []).find((a) =>
      /^danny$/i.test(String(a.name || "")),
    ) ||
    (agents.json?.data || []).find((a) =>
      /appointment receptionist/i.test(String(a.name || "")),
    );
  if (!agent?.id) {
    console.error("Danny agent not found");
    process.exit(1);
  }
  console.log("OK agent", agent.name, agent.id, agent.telnyxAssistantId);

  const beforeLive = await api(jar, "/api/voice/ai", {
    method: "POST",
    body: { action: "fetch_live_assistant", agentId: agent.id },
  });
  console.log(
    "BEFORE live",
    JSON.stringify(
      {
        model: beforeLive.json?.data?.model,
        transcription: beforeLive.json?.data?.transcription,
        start_speaking_plan:
          beforeLive.json?.data?.interruption_settings?.start_speaking_plan,
        toolCount: beforeLive.json?.data?.toolCount,
      },
      null,
      2,
    ),
  );

  const loaded = await api(jar, `/api/voice/agents/${agent.id}`);
  const draft = loaded.json?.data?.draftConfig || {};
  const rollbackSnapshot = {
    capturedAt: new Date().toISOString(),
    fromProfile: draft.voiceTiming?.activeProfile || "flux_b_balanced",
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

  const nextDraft = {
    ...draft,
    transcription: {
      ...(draft.transcription || {}),
      enabled: true,
      sttProvider: "deepgram",
      sttModel: "deepgram/flux",
      language: draft.transcription?.language || "en",
      keyterms: draft.transcription?.keyterms,
      settings: {
        eot_threshold: AGGRESSIVE.eot_threshold,
        eager_eot_threshold: AGGRESSIVE.eager_eot_threshold,
        eot_timeout_ms: AGGRESSIVE.eot_timeout_ms,
      },
    },
    voiceLanguage: {
      ...(draft.voiceLanguage || {}),
      bargeIn: draft.voiceLanguage?.bargeIn !== false,
    },
    voiceTiming: {
      ...(draft.voiceTiming || {}),
      activeProfile: "flux_h_aggressive",
      experimental: true,
      rollbackSnapshot,
      diagnostics: {
        versionLabel: "H",
        ordinaryTurnPrimaryGoalMs: 500,
        metric: "caller_end_of_speech_to_first_audible_agent_audio",
        skipDynamicVariablesWebhook: true,
        startSpeakingPlan: {
          waitSeconds: AGGRESSIVE.wait_seconds,
          fluxOmitTranscriptionEndpointingPlan: true,
        },
        note: "H-aggressive Flux timing on Danny (official ULL H/F params). Do not claim sub-500ms until phone measurements confirm.",
        telnyxFieldPlan: {
          eot_threshold: "sent_and_applicable",
          eager_eot_threshold: "sent_and_applicable",
          eot_timeout_ms: "sent_and_applicable",
          start_speaking_wait_seconds: "sent_and_applicable",
        },
      },
    },
  };
  // Drop leftover local endpointingMs so it cannot compete with wait_seconds.
  if (nextDraft.voiceLanguage?.endpointingMs != null) {
    delete nextDraft.voiceLanguage.endpointingMs;
  }

  const patched = await api(jar, `/api/voice/agents/${agent.id}`, {
    method: "PATCH",
    body: { draftConfig: nextDraft },
  });
  if (!patched.ok) {
    console.error("PATCH failed", patched.status, JSON.stringify(patched.json).slice(0, 800));
    process.exit(1);
  }
  console.log("OK draft patched with H-aggressive settings");

  const pub = await api(jar, `/api/voice/agents/${agent.id}`, {
    method: "PATCH",
    body: { action: "publish" },
  });
  if (!pub.ok) {
    console.error("PUBLISH failed", pub.status, JSON.stringify(pub.json).slice(0, 1200));
    process.exit(1);
  }
  console.log("OK published (DID reclaim + Telnyx sync)");

  // Prefer direct Telnyx timing patch (bypasses product wait floor on older deploys).
  const timingPatch = await api(jar, "/api/voice/telnyx-official-baseline", {
    method: "POST",
    bootstrap: true,
    body: {
      action: "apply_agent_timing",
      workspaceId: "ws_1",
      e164: PHONE_E164,
      assistantId: agent.telnyxAssistantId,
      productionAgentId: agent.id,
      timingId: TIMING,
      includePunctuationPlan: false,
    },
  });
  if (timingPatch.ok) {
    console.log(
      "OK apply_agent_timing",
      JSON.stringify(
        {
          timingId: timingPatch.json?.data?.timingId,
          timing: timingPatch.json?.data?.timing,
          preserved: timingPatch.json?.data?.preserved,
          route: timingPatch.json?.data?.route?.path,
        },
        null,
        2,
      ),
    );
    save("h-timing-telnyx-patch.json", timingPatch.json);
  } else {
    console.warn(
      "apply_agent_timing not live on deploy yet — using publish sync only",
      timingPatch.status,
      JSON.stringify(timingPatch.json).slice(0, 400),
    );
  }

  const afterLive = await api(jar, "/api/voice/ai", {
    method: "POST",
    body: { action: "fetch_live_assistant", agentId: agent.id },
  });
  const live = afterLive.json?.data || {};
  const summary = {
    agentId: agent.id,
    name: agent.name,
    telnyxAssistantId: live.telnyxAssistantId || agent.telnyxAssistantId,
    model: live.model,
    toolCount: live.toolCount,
    transcription: live.transcription,
    start_speaking_plan: live.interruption_settings?.start_speaking_plan,
    draftProfile: "flux_h_aggressive",
    expected: AGGRESSIVE,
  };
  save("h-timing-live.json", summary);
  console.log("AFTER live", JSON.stringify(summary, null, 2));

  const settings = live.transcription?.settings || {};
  const wait =
    live.interruption_settings?.start_speaking_plan?.wait_seconds;
  const okEot =
    Number(settings.eot_threshold) === AGGRESSIVE.eot_threshold &&
    Number(settings.eager_eot_threshold) === AGGRESSIVE.eager_eot_threshold &&
    Number(settings.eot_timeout_ms) === AGGRESSIVE.eot_timeout_ms;
  const okWait = Number(wait) === AGGRESSIVE.wait_seconds;
  if (!okEot) {
    console.error("FAIL EOT settings not matched on live Danny");
    process.exit(1);
  }
  if (!okWait) {
    console.warn(
      `WARN wait_seconds live=${wait} expected=${AGGRESSIVE.wait_seconds} (product floor may still be 0.1 until deploy)`,
    );
  } else {
    console.log("OK full H-aggressive timing on Danny");
  }
  console.log(`\nCall ${PHONE_E164} — should reach Danny with H timing.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
