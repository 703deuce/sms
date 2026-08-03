/**
 * Switch Phone Test Desk between Telnyx/ElevenLabs A/B candidates.
 * Does NOT change instructions, greeting, LLM, STT, tools, or interruption.
 * Never silently remaps a rejected voice.
 *
 * Usage:
 *   node scripts/voice-ab-switch.mjs list
 *   node scripts/voice-ab-switch.mjs switch astra-naturalhd
 *   node scripts/voice-ab-switch.mjs switch allie-ultra --expressive=false
 *   node scripts/voice-ab-switch.mjs switch allie-ultra --expressive=true
 *   node scripts/voice-ab-switch.mjs switch alexandra-flash
 *   node scripts/voice-ab-switch.mjs scorecard
 */

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const AGENT_ID = (process.env.AGENT_ID || "cmsc3nw966a414a5h722y2s64").trim();
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();

/** Mirrors src/lib/voice/telnyx/receptionist-ab.ts — keep in sync. */
const CANDIDATES = [
  {
    id: "astra-naturalhd",
    displayName: "Astra",
    voiceRef: "Telnyx.NaturalHD.astra",
    providerVoiceId: "Telnyx.NaturalHD.astra",
    provider: "telnyx",
    model: "NaturalHD",
    expressiveVariants: false,
    defaultExpressiveMode: false,
  },
  {
    id: "allie-ultra",
    displayName: "Allie",
    voiceRef: "Telnyx.Ultra.2747b6cf-fa34-460c-97db-267566918881",
    providerVoiceId: "Telnyx.Ultra.2747b6cf-fa34-460c-97db-267566918881",
    provider: "telnyx",
    model: "Ultra",
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
  {
    id: "maia-ultra",
    displayName: "Maia (Mia stand-in)",
    voiceRef: "Telnyx.Ultra.5a033900-2ed6-4fd4-a257-707f2688e713",
    providerVoiceId: "Telnyx.Ultra.5a033900-2ed6-4fd4-a257-707f2688e713",
    provider: "telnyx",
    model: "Ultra",
    expressiveVariants: true,
    defaultExpressiveMode: false,
    note: "Mia - Agent not in Telnyx catalog 2026-08-03; Maia - Agile Support used instead",
  },
  {
    id: "callie-ultra",
    displayName: "Callie",
    voiceRef: "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
    providerVoiceId: "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
    provider: "telnyx",
    model: "Ultra",
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
  {
    id: "alexandra-flash",
    displayName: "Alexandra Flash",
    voiceRef: "el:eleven_flash_v2_5:kdmDKE6EkgrWrrykO9Qt",
    providerVoiceId: "ElevenLabs.eleven_flash_v2_5.kdmDKE6EkgrWrrykO9Qt",
    provider: "elevenlabs",
    model: "eleven_flash_v2_5",
    expressiveVariants: false,
    defaultExpressiveMode: false,
    elevenLabsTuning: { stability: 0.45, similarityBoost: 0.75, speed: 1.0 },
  },
  {
    id: "cindy-ultra",
    displayName: "Cindy",
    voiceRef: "Telnyx.Ultra.1242fb95-7ddd-44ac-8a05-9e8a22a6137d",
    providerVoiceId: "Telnyx.Ultra.1242fb95-7ddd-44ac-8a05-9e8a22a6137d",
    provider: "telnyx",
    model: "Ultra",
    optional: true,
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
  {
    id: "howard-ultra",
    displayName: "Howard",
    voiceRef: "Telnyx.Ultra.0d42f0f6-c019-4082-b250-1c16133d1c82",
    providerVoiceId: "Telnyx.Ultra.0d42f0f6-c019-4082-b250-1c16133d1c82",
    provider: "telnyx",
    model: "Ultra",
    optional: true,
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
  {
    id: "jasper-ultra",
    displayName: "Jasper",
    voiceRef: "Telnyx.Ultra.3faa81ae-d3d8-4ab1-9e44-e50e46d33c30",
    providerVoiceId: "Telnyx.Ultra.3faa81ae-d3d8-4ab1-9e44-e50e46d33c30",
    provider: "telnyx",
    model: "Ultra",
    optional: true,
    expressiveVariants: true,
    defaultExpressiveMode: false,
  },
];const SCRIPT = [
  "Thank you for calling Transovo. I can take a message or help you schedule an appointment. How may I help you today?",
  "Okay, I can help with that. May I have your first and last name?",
  "Let me confirm your phone number: five seven one, five five five, zero one two three.",
  "I have Tuesday at ten thirty in the morning or Thursday at two fifteen in the afternoon. Which works better for you?",
  "I'm sorry you're dealing with that. Let me collect a few details so I can get the correct person to help you.",
];

const SCORE_FIELDS = [
  "timeToFirstAudio",
  "averageTurnLatency",
  "pronunciationNamesNumbersTimes",
  "interruptionBehavior",
  "perceivedNaturalness",
  "soundsLikeTtsReader",
  "naturalAfterTwoMinutes",
];

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

function findCandidate(id) {
  const raw = String(id || "").trim().toLowerCase();
  return (
    CANDIDATES.find(
      (c) =>
        c.id === raw ||
        c.voiceRef === raw ||
        c.providerVoiceId.toLowerCase() === raw ||
        c.displayName.toLowerCase() === raw,
    ) || null
  );
}

function parseExpressive(argv, candidate) {
  const flag = argv.find((a) => a.startsWith("--expressive="));
  if (flag) return flag.split("=")[1] !== "false";
  if (candidate.model === "Ultra") return Boolean(candidate.defaultExpressiveMode);
  return false;
}

async function login() {
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
  return jar;
}

function printList() {
  console.log(
    JSON.stringify(
      {
        phone: PHONE_E164,
        agentId: AGENT_ID,
        keepIdentical: [
          "assistant instructions",
          "greeting",
          "LLM",
          "STT",
          "tools",
          "interruption settings",
          "phone number",
          "test script",
        ],
        miaCatalogNote:
          "Mia - Agent not in Telnyx Available Voices catalog (2026-08-03). Using Maia - Agile Support UUID instead.",
        cindyUuid: "Telnyx.Ultra.1242fb95-7ddd-44ac-8a05-9e8a22a6137d",
        candidates: CANDIDATES,
        script: SCRIPT,
        ultraProtocol: "First call expressive_mode=false, second call expressive_mode=true",
      },
      null,
      2,
    ),
  );
}

function printScorecard() {
  const rows = [];
  for (const c of CANDIDATES) {
    const variants =
      c.model === "Ultra" ? [false, true] : [null];
    for (const expressive of variants) {
      rows.push({
        candidateId: c.id,
        displayName: c.displayName,
        providerVoiceId: c.providerVoiceId,
        expressiveMode: expressive,
        ...Object.fromEntries(SCORE_FIELDS.map((f) => [f, null])),
        notes: "",
      });
    }
  }
  console.log(
    JSON.stringify(
      {
        verdicts: {
          bestTelnyxVoice: null,
          closestTelnyxToElevenLabsFlash: null,
          fastestVoice: null,
          mostNaturalVoice: null,
        },
        rows,
        script: SCRIPT,
      },
      null,
      2,
    ),
  );
}

async function switchCandidate(candidateId, argv) {
  const candidate = findCandidate(candidateId);
  if (!candidate) {
    console.error(`Unknown candidate: ${candidateId}`);
    console.error(`Known: ${CANDIDATES.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }
  const expressive = parseExpressive(argv, candidate);
  const jar = await login();
  log(true, "smoke-login");

  const loaded = await api(jar, `/api/voice/agents/${AGENT_ID}`);
  if (!loaded.res.ok) {
    log(false, "load agent", JSON.stringify(loaded.json).slice(0, 300));
    process.exit(1);
  }
  const agent = loaded.json.data;
  const draft = agent.draftConfig || {};
  const prevVoice = draft.voiceLanguage?.voiceId;
  log(
    true,
    "loaded",
    `${agent.name} prev=${prevVoice} telnyx=${agent.telnyxAssistantId}`,
  );

  // Always persist the EXACT provider string for Telnyx A/B candidates.
  // Catalog aliases like "allie-ultra" are unknown on older deploys and would
  // silently resolve to NaturalHD Astra via FALLBACK_PROVIDER_VOICE_ID.
  const persistedVoiceRef =
    candidate.provider === "elevenlabs"
      ? candidate.voiceRef
      : candidate.providerVoiceId;

  // Voice-only patch — preserve every other draftConfig field.
  const voiceLanguage = {
    ...(draft.voiceLanguage || {}),
    voiceId: persistedVoiceRef,
    expressiveMode: candidate.model === "Ultra" ? expressive : false,
    speed: candidate.elevenLabsTuning?.speed ?? draft.voiceLanguage?.speed ?? 1,
  };

  if (candidate.provider === "elevenlabs") {
    voiceLanguage.voiceProvider = "elevenlabs";
    voiceLanguage.elevenLabsApiKeyRef = "elevenlabs_transovo";
    voiceLanguage.elevenLabsTuning = true;
    voiceLanguage.elevenLabsStability =
      candidate.elevenLabsTuning?.stability ?? 0.45;
    voiceLanguage.elevenLabsSimilarityBoost =
      candidate.elevenLabsTuning?.similarityBoost ?? 0.75;
  } else {
    voiceLanguage.voiceProvider = "telnyx";
    // Keep EL refs in draft for easy switch-back, but sync clears api_key_ref on Telnyx.
    voiceLanguage.elevenLabsTuning = false;
  }

  const nextDraft = {
    ...draft,
    voiceLanguage,
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

  // Preflight clone probe — fail before touching production if Telnyx rejects.
  const probe = await api(jar, `/api/voice/ai`, {
    method: "POST",
    body: {
      action: "test_voice",
      agentId: AGENT_ID,
      voice: candidate.providerVoiceId.startsWith("ElevenLabs.")
        ? candidate.voiceRef
        : candidate.providerVoiceId,
      expressiveMode: candidate.model === "Ultra" ? expressive : false,
      includeElevenLabsTuning: candidate.provider === "elevenlabs",
    },
  });
  const probeOk = probe.res.ok && probe.json.data?.ok !== false && probe.json.data?.readBackMatch !== false;
  log(
    probeOk,
    "preflight clone probe",
    probeOk
      ? `remote=${probe.json.data?.remoteVoice} expressive=${probe.json.data?.remoteExpressive}`
      : JSON.stringify(probe.json).slice(0, 500),
  );
  if (!probeOk) {
    console.error("ABORT: Telnyx rejected voice on clone — production not changed beyond draft.");
    process.exit(1);
  }

  const built = await api(jar, `/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    body: { action: "build" },
  });
  log(
    built.res.ok,
    "build",
    built.res.ok
      ? `v${built.json.version} health=${built.json.healthStatus || built.json.data?.healthStatus}`
      : JSON.stringify(built.json).slice(0, 500),
  );
  if (!built.res.ok) process.exit(1);

  const health = built.json.healthStatus || built.json.data?.healthStatus;
  if (health && health !== "ok") {
    log(false, "health gate", String(health));
    console.error("ABORT: build health not ok — check Telnyx sync; no silent fallback.");
    process.exit(1);
  }

  const deployed = await api(jar, `/api/voice/agents/${AGENT_ID}`, {
    method: "PATCH",
    body: { action: "deploy" },
  });
  log(
    deployed.res.ok,
    "deploy",
    deployed.res.ok
      ? `v${deployed.json.version}`
      : JSON.stringify(deployed.json).slice(0, 500),
  );
  if (!deployed.res.ok) process.exit(1);

  const after = await api(jar, `/api/voice/agents/${AGENT_ID}`);
  const vl = after.json.data?.draftConfig?.voiceLanguage || {};
  console.log(
    JSON.stringify(
      {
        phone: PHONE_E164,
        liveNow: {
          candidateId: candidate.id,
          displayName: candidate.displayName,
          voiceRef: vl.voiceId,
          expectedProviderVoice: candidate.providerVoiceId,
          expressiveMode: vl.expressiveMode,
          elevenLabsTuning: vl.elevenLabsTuning || false,
          note: candidate.note || null,
        },
        previousVoiceRef: prevVoice,
        callForAtLeastTwoMinutes: true,
        script: SCRIPT,
        scoreFields: SCORE_FIELDS,
        nextUltraTip:
          candidate.model === "Ultra" && !expressive
            ? `After this call, re-run with: node scripts/voice-ab-switch.mjs switch ${candidate.id} --expressive=true`
            : null,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const [cmd, arg, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "list") {
    printList();
    return;
  }
  if (cmd === "scorecard") {
    printScorecard();
    return;
  }
  if (cmd === "switch") {
    if (!arg) {
      console.error("Usage: node scripts/voice-ab-switch.mjs switch <candidate-id> [--expressive=false|true]");
      process.exit(1);
    }
    await switchCandidate(arg, rest);
    return;
  }
  console.error(`Unknown command ${cmd}. Use list | switch | scorecard`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
