/**
 * Telnyx-direct baseline profile switcher for +1866.
 *
 * Shared: Flux STT + Ultra TTS + short prompt + fixed greeting. No tools / webhooks.
 *
 * A/B/C/D — LLM only on the untouched baseline (timing unchanged):
 *   A = anthropic/claude-haiku-4-5
 *   B = moonshotai/Kimi (live id)
 *   C = google/gemini-2.5-flash (+ gemini_api_key)
 *   D = openai/gpt-5.4-mini (+ openai_key)
 *
 * E/F/G/H — separate clones (baseline assistant never overwritten):
 *   E = Haiku Fast
 *   F = Haiku Aggressive (experimental)
 *   G = Kimi Fast
 *   H = Kimi Aggressive (experimental)
 *
 * Usage:
 *   node scripts/telnyx-official-baseline-866.mjs --list-profiles
 *   node scripts/telnyx-official-baseline-866.mjs --ensure-clones
 *   node scripts/telnyx-official-baseline-866.mjs --profile A|B|C|D|E|F|G|H
 *   node scripts/telnyx-official-baseline-866.mjs --verify
 *   node scripts/telnyx-official-baseline-866.mjs --score
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com")
  .trim()
  .toLowerCase();
const E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const OUT_DIR =
  process.env.BASELINE_OUT || "/opt/cursor/artifacts/telnyx-official-baseline";
const DEFAULT_ASSISTANT =
  process.env.BASELINE_ASSISTANT_ID ||
  "assistant-f2a573af-dde1-4441-a6f1-846aeccc1020";
const GEMINI_KEY_REF = process.env.GEMINI_API_KEY_REF || "gemini_api_key";
const OPENAI_KEY_REF = process.env.OPENAI_API_KEY_REF || "openai_key";

const CREATE_ONLY = process.argv.includes("--create-only");
const VERIFY_SECRET = process.argv.includes("--verify-secret");
const LIST_PROFILES = process.argv.includes("--list-profiles");
const ENSURE_CLONES = process.argv.includes("--ensure-clones");
const SCORE =
  process.argv.includes("--score") || process.argv.includes("--pull-latency");
const VERIFY_IDX = process.argv.indexOf("--verify");
const RESTORE_IDX = process.argv.indexOf("--restore");
const PROFILE_IDX = process.argv.indexOf("--profile");
const MODEL_IDX = process.argv.indexOf("--model");
const SWITCH_IDX = process.argv.indexOf("--switch-model");
const ASSISTANT_IDX = process.argv.indexOf("--assistant");
const LIMIT_IDX = process.argv.indexOf("--limit");
const LIMIT_ARG =
  LIMIT_IDX >= 0 ? Number(process.argv[LIMIT_IDX + 1] || "20") : 20;

const PROFILE_ARG =
  PROFILE_IDX >= 0 ? String(process.argv[PROFILE_IDX + 1] || "").trim() : "";
const MODEL_ARG =
  MODEL_IDX >= 0 ? String(process.argv[MODEL_IDX + 1] || "").trim() : "";
const SWITCH_MODEL =
  SWITCH_IDX >= 0 ? String(process.argv[SWITCH_IDX + 1] || "").trim() : "";
const ASSISTANT_ARG =
  ASSISTANT_IDX >= 0
    ? String(process.argv[ASSISTANT_IDX + 1] || "").trim()
    : "";

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

async function post(jar, body) {
  const res = await fetch(`${BASE}/api/voice/telnyx-official-baseline`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
      cookie: cookieHeader(jar),
    },
    body: JSON.stringify({
      ...body,
      workspaceId: "ws_1",
      e164: E164,
      geminiKeyRef: GEMINI_KEY_REF,
      openaiKeyRef: OPENAI_KEY_REF,
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 2000) };
  }
  return { status: res.status, json, ok: res.ok };
}

function save(name, data) {
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    const path = join(OUT_DIR, name);
    writeFileSync(path, JSON.stringify(data, null, 2));
    console.log("saved", path);
  } catch (err) {
    console.warn(
      "could not save artifact",
      name,
      err instanceof Error ? err.message : err,
    );
  }
}

function resolveAssistantId() {
  if (ASSISTANT_ARG) return ASSISTANT_ARG;
  const snapPath = join(OUT_DIR, "snapshot.json");
  if (existsSync(snapPath)) {
    try {
      const snap = JSON.parse(readFileSync(snapPath, "utf8"));
      const id =
        snap?.snapshot?.assistantId ||
        snap?.assistantId ||
        snap?.route?.assistantId;
      if (id) return String(id);
    } catch {
      // ignore
    }
  }
  return DEFAULT_ASSISTANT;
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
  const login = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !login.ok) {
    console.error("login failed", login);
    process.exit(1);
  }
  console.log("OK login", login.workspaceName || OWNER_EMAIL);

  if (LIST_PROFILES) {
    const out = await post(jar, { action: "list_profiles" });
    console.log(JSON.stringify(out.json, null, 2));
    process.exit(out.ok ? 0 : 1);
  }

  if (ENSURE_CLONES) {
    console.log("Ensuring E/F/G/H turn clones (A–D baseline untouched)…");
    const out = await post(jar, {
      action: "ensure_turn_clones",
      assistantId: resolveAssistantId(),
    });
    if (!out.ok) {
      console.error("FAIL", out.status, JSON.stringify(out.json).slice(0, 4000));
      process.exit(1);
    }
    save("turn-clones.json", out.json);
    const d = out.json?.data || {};
    console.log("kimi model:", d.kimi?.modelId, `(${d.kimi?.source})`);
    for (const c of d.clones || []) {
      console.log(
        `  ${c.profileId} ${c.profile?.label} → ${c.assistantId} model=${c.usedModel} live=${c.verification?.liveLabel} created=${c.created}`,
      );
    }
    process.exit(0);
  }

  if (VERIFY_SECRET) {
    for (const id of [GEMINI_KEY_REF, OPENAI_KEY_REF]) {
      const out = await post(jar, {
        action: "verify_secret",
        secretIdentifier: id,
      });
      console.log(
        id,
        out.ok && out.json?.data?.exists ? "OK present" : "MISSING",
        JSON.stringify(out.json?.data || out.json),
      );
    }
    process.exit(0);
  }

  const profileOrSwitch = PROFILE_ARG || SWITCH_MODEL;
  if (profileOrSwitch) {
    const assistantId = resolveAssistantId();
    const letter = String(profileOrSwitch).trim().toUpperCase();
    const isLetter = /^[A-H]$/.test(letter);
    console.log(
      `Switching → ${isLetter ? `profile ${letter}` : profileOrSwitch} (source ${assistantId})`,
    );
    const out = await post(jar, {
      action: "switch_profile",
      assistantId,
      ...(isLetter ? { profileId: letter } : { modelId: profileOrSwitch }),
    });
    if (!out.ok) {
      console.error("FAIL", out.status, JSON.stringify(out.json).slice(0, 4000));
      process.exit(1);
    }
    const tag = isLetter
      ? letter
      : profileOrSwitch.replace(/\//g, "_");
    save(`switch-${tag}.json`, out.json);
    const d = out.json?.data || {};
    console.log(
      JSON.stringify(
        {
          profileId: d.profileId,
          label: d.profile?.label || d.profile?.id,
          assistantId: d.assistantId || d.live?.name,
          usedModel: d.usedModel || d.live?.model,
          verification: d.verification?.liveLabel || d.matched,
          route: d.route?.path || d.route,
          experimental: d.profile?.experimental,
          timing: d.profile?.timing || d.profile?.timingId,
        },
        null,
        2,
      ),
    );
    console.log(`\nCall ${E164} now to test this profile.`);
    process.exit(0);
  }

  if (SCORE) {
    const assistantId = resolveAssistantId();
    console.log(
      `Pulling Telnyx response gaps for ${assistantId} (limit=${LIMIT_ARG})…`,
    );
    const out = await post(jar, {
      action: "score_latency",
      assistantId,
      limit: Number.isFinite(LIMIT_ARG) ? LIMIT_ARG : 20,
    });
    if (!out.ok) {
      console.error("FAIL", out.status, JSON.stringify(out.json).slice(0, 2500));
      process.exit(1);
    }
    save("latency-score.json", out.json);
    const d = out.json?.data || {};
    console.log("\n=== TIME-TO-RESPONSE (Telnyx message gaps, ms) ===");
    console.log("metric:", d.metric);
    console.log(
      "overall:",
      JSON.stringify(d.overall),
      `from ${d.sampleCount || 0} turns / ${d.conversationCount || 0} calls`,
    );
    console.log("\nby profile:");
    for (const row of d.byProfile || []) {
      console.log(
        `  ${row.profileId}: n=${row.sampleCount} calls=${row.callCount} p50=${row.p50Ms}ms p75=${row.p75Ms}ms p95=${row.p95Ms}ms mean=${row.meanMs}ms min=${row.minMs}ms max=${row.maxMs}ms`,
      );
    }
    console.log("\nper call:");
    for (const call of d.calls || []) {
      const gaps = (call.samples || []).map((s) => s.latencyMs).join(",");
      console.log(
        `  ${call.createdAt || "?"} profile=${call.profileId || "?"} model=${call.model || "?"} msgs=${call.messageCount} p50=${call.p50Ms}ms gaps=[${gaps}]${call.messageFetchError ? ` ERR=${call.messageFetchError}` : ""}`,
      );
    }
    process.exit(0);
  }

  if (VERIFY_IDX >= 0) {
    const maybeId = process.argv[VERIFY_IDX + 1];
    const assistantId =
      maybeId && !maybeId.startsWith("--") ? maybeId : resolveAssistantId();
    const out = await post(jar, { action: "verify", assistantId });
    console.log(JSON.stringify(out.json, null, 2));
    save(`verify-${assistantId}.json`, out.json);
    process.exit(out.ok ? 0 : 1);
  }

  if (RESTORE_IDX >= 0) {
    const file = process.argv[RESTORE_IDX + 1];
    const snapshot = JSON.parse(readFileSync(file, "utf8"));
    const out = await post(jar, {
      action: "restore",
      snapshot: snapshot.snapshot || snapshot,
    });
    console.log(JSON.stringify(out.json, null, 2));
    process.exit(out.ok ? 0 : 1);
  }

  const action = CREATE_ONLY ? "create" : "create_and_route";
  console.log(`Calling ${BASE} action=${action} e164=${E164}`);
  const out = await post(jar, {
    action,
    ...(MODEL_ARG ? { modelId: MODEL_ARG } : {}),
    ...(PROFILE_ARG ? { profileId: PROFILE_ARG } : { profileId: "A" }),
  });
  if (!out.ok) {
    console.error("FAIL", out.status, JSON.stringify(out.json).slice(0, 2500));
    process.exit(1);
  }

  const d = out.json?.data || {};
  save("requested.json", d.createBody || d.requestedStack);
  save("create-response.json", d.createResponse);
  save("live.json", d.live);
  save("versions.json", d.versions);
  save("diffs.json", d.diffs);
  save("provider-inserted.json", d.providerInserted);
  save("route.json", d.route);
  if (d.route?.snapshot) save("snapshot.json", d.route);

  console.log("\n=== BASELINE READY ===");
  console.log("assistantId:", d.assistantId);
  console.log("profileId:", d.profileId);
  console.log("usedModel:", d.usedModel);
  console.log("llm_api_key_ref:", d.live?.llm_api_key_ref ?? d.llmApiKeyRef);
  if (d.route?.route) console.log("ROUTE:", d.route.route.path);
  console.log(`\nCall ${E164}. Switch with --profile A|B|C|D|E|F|G|H`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
