/**
 * B-Fast live verify + PSTN benchmark scorecard for +18663464256.
 *
 * Usage:
 *   node scripts/voice-latency-bfast-benchmark.mjs
 *   node scripts/voice-latency-bfast-benchmark.mjs --verify-only
 *   node scripts/voice-latency-bfast-benchmark.mjs --score
 *   node scripts/voice-latency-bfast-benchmark.mjs --manual 420,380,510,460,390
 *
 * Does not claim sub-500 ms without telephone measurements.
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const AGENT_ID = process.env.AGENT_ID || "cmsdkcnwr5p3i5s0h3i1x0j60";
const TELNYX_ASSISTANT_ID =
  process.env.TELNYX_ASSISTANT_ID || "assistant-32808bf3-cd1b-4d39-bbf0-1e193985ee7d";

const VERIFY_ONLY = process.argv.includes("--verify-only");
const SCORE = process.argv.includes("--score") || !VERIFY_ONLY;
const MANUAL_IDX = process.argv.indexOf("--manual");
const MANUAL_RAW =
  MANUAL_IDX >= 0 ? String(process.argv[MANUAL_IDX + 1] || "") : "";

const EXPECTED = {
  profile: "flux_b_fast",
  model: "anthropic/claude-haiku-4-5",
  stt: "deepgram/flux",
  eot_threshold: 0.75,
  eager_eot_threshold: 0.35,
  eot_timeout_ms: 5000,
  wait_seconds: 0.1,
  voicePrefix: "Telnyx.Ultra.",
};

const PROTOCOL = [
  { id: "yes", phrase: "Yes.", turns: 3 },
  { id: "no", phrase: "No.", turns: 3 },
  { id: "tuesday", phrase: "Tuesday.", turns: 3 },
  { id: "tomorrow_morning", phrase: "Tomorrow morning.", turns: 3 },
  { id: "one_sentence", phrase: "I need to book a service appointment.", turns: 3 },
  { id: "mid_pause", phrase: "I was wondering… (1–2s pause) …about pricing.", turns: 3 },
  { id: "change_answer", phrase: "Monday—wait, actually Tuesday.", turns: 3 },
  { id: "phone", phrase: "My number is 703-555-0142.", turns: 3 },
  { id: "address", phrase: "123 Main Street, Arlington, Virginia 22201.", turns: 3 },
  { id: "interrupt", phrase: "Interrupt with “wait” / “no” mid-reply.", turns: 3 },
];

const TARGETS = { p50: 500, p75: 650, p95: 900 };

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

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx] ?? null;
}

function summarizeMs(samples) {
  const sorted = [...samples].filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p95: percentile(sorted, 95),
    mean: sorted.length
      ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
      : null,
    min: sorted[0] ?? null,
    max: sorted[sorted.length - 1] ?? null,
  };
}

function passTargets(summary) {
  return {
    p50: summary.p50 != null && summary.p50 < TARGETS.p50,
    p75: summary.p75 != null && summary.p75 < TARGETS.p75,
    p95: summary.p95 != null && summary.p95 < TARGETS.p95,
  };
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

  const profile = await api(jar, `/api/voice/agents/${AGENT_ID}/latency-profile`);
  const live = await api(jar, "/api/voice/ai", {
    method: "POST",
    body: {
      action: "fetch_live_assistant",
      assistantId: TELNYX_ASSISTANT_ID,
      agentId: AGENT_ID,
    },
  });

  const p = profile.json?.data || {};
  const a = live.json?.data || {};
  const settings = a.transcription?.settings || {};
  const speak = a.interruption_settings?.start_speaking_plan || {};
  const voice = a.voice_settings?.voice || "";

  const checks = [
    ["activeProfile", p.activeProfile === EXPECTED.profile, p.activeProfile],
    ["model", a.model === EXPECTED.model, a.model],
    ["stt", a.transcription?.model === EXPECTED.stt, a.transcription?.model],
    [
      "eot_threshold",
      settings.eot_threshold === EXPECTED.eot_threshold,
      settings.eot_threshold,
    ],
    [
      "eager_eot_threshold",
      settings.eager_eot_threshold === EXPECTED.eager_eot_threshold,
      settings.eager_eot_threshold,
    ],
    [
      "eot_timeout_ms",
      settings.eot_timeout_ms === EXPECTED.eot_timeout_ms,
      settings.eot_timeout_ms,
    ],
    [
      "wait_seconds",
      speak.wait_seconds === EXPECTED.wait_seconds,
      speak.wait_seconds,
    ],
    [
      "transcription_endpointing_plan_cleared",
      speak.transcription_endpointing_plan == null,
      speak.transcription_endpointing_plan,
    ],
    [
      "on_no_punctuation_absent",
      speak.on_no_punctuation_seconds == null,
      speak.on_no_punctuation_seconds,
    ],
    [
      "on_number_absent",
      speak.on_number_seconds == null,
      speak.on_number_seconds,
    ],
    ["ultra_voice", String(voice).startsWith(EXPECTED.voicePrefix), voice],
    [
      "interruptions",
      a.interruption_settings?.enable === true,
      a.interruption_settings?.enable,
    ],
    [
      "dynvar_webhook_null",
      a.dynamic_variables_webhook_url == null,
      a.dynamic_variables_webhook_url,
    ],
    ["fixed_greeting", Boolean(a.greeting), a.greeting],
  ];

  let failed = 0;
  console.log("\n=== B-FAST LIVE VERIFY ===");
  console.log(`Phone ${PHONE_E164}  agent ${AGENT_ID}`);
  for (const [name, ok, value] of checks) {
    console.log(`${ok ? "OK " : "FAIL"}  ${name}: ${JSON.stringify(value)}`);
    if (!ok) failed += 1;
  }
  if (failed) {
    console.error(`\n${failed} verify check(s) failed. Apply with:`);
    console.error("  node scripts/voice-latency-flux-ab-866.mjs --profile B_FAST");
    process.exit(1);
  }
  console.log("\nB-Fast is live on Telnyx (Flux 0.75/0.35 + Haiku + Ultra).");

  if (VERIFY_ONLY) return;

  console.log("\n=== PSTN TEST PROTOCOL (B-FAST) ===");
  console.log(`Call ${PHONE_E164}. Measure caller end-of-turn → first audible assistant audio.`);
  console.log(`Targets: p50 < ${TARGETS.p50} ms, p75 < ${TARGETS.p75} ms, p95 < ${TARGETS.p95} ms`);
  console.log("Also record: premature-response rate, caller cutoff rate, transcript accuracy, task completion.");
  console.log(`Aim for ≥30 ordinary turns. Suggested matrix (${PROTOCOL.reduce((n, r) => n + r.turns, 0)} turns):\n`);
  for (const row of PROTOCOL) {
    console.log(`  ${String(row.turns).padStart(2)}×  ${row.id.padEnd(18)}  "${row.phrase}"`);
  }
  console.log("\nPromote B-Fast only if pauses, addresses, and phone numbers stay natural.");
  console.log("Compare later with: node scripts/voice-latency-flux-ab-866.mjs --profile B_BALANCED");

  if (SCORE) {
    const analytics = await api(
      jar,
      `/api/voice/analytics?agentId=${AGENT_ID}&periodDays=7`,
    );
    const lat = analytics.json?.data?.latency || {};
    console.log("\n=== PLATFORM RESPONSE LATENCY (auto-captured) ===");
    console.log(
      JSON.stringify(
        {
          sampleSize: lat.responseLatencySampleSize ?? 0,
          avgMs: lat.avgResponseLatencyMs,
          medianMs: lat.medianResponseLatencyMs,
          p95Ms: lat.p95ResponseLatencyMs,
          toolAvgMs: lat.avgToolLatencyMs,
          toolP95Ms: lat.p95ToolLatencyMs,
        },
        null,
        2,
      ),
    );
    if (!lat.responseLatencySampleSize) {
      console.log(
        "No auto samples yet. Use a stopwatch / recorder on PSTN, then pass --manual ms,ms,...",
      );
    }

    const diag = await api(jar, "/api/voice/ai", {
      method: "POST",
      body: { action: "diagnose_recent_voice_calls", agentId: AGENT_ID },
    });
    const recent = diag.json?.data?.recent || [];
    console.log("\n=== RECENT CALLS ===");
    for (const c of recent.slice(0, 8)) {
      console.log(
        `  ${c.createdAt}  call=${c.callId}  conv=${c.telnyxConversationId}  err=${c.telnyxError || "none"}`,
      );
    }
  }

  if (MANUAL_RAW) {
    const samples = MANUAL_RAW.split(/[,\s]+/)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    const summary = summarizeMs(samples);
    const pass = passTargets(summary);
    console.log("\n=== MANUAL SCORECARD (B-FAST) ===");
    console.log(JSON.stringify({ samples, summary, targets: TARGETS, pass }, null, 2));
    const allPass = pass.p50 && pass.p75 && pass.p95;
    console.log(
      allPass
        ? "\nManual samples meet ordinary-turn targets (still review cutoff/false-EOT rates before promoting)."
        : "\nManual samples miss one or more targets — keep B-Balanced as production default.",
    );
  }

  console.log(
    "\nDo not claim sub-500 ms until real telephone measurements confirm it.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
