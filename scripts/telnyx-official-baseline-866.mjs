/**
 * Telnyx-direct ultra-low-latency baseline ops for +1866.
 *
 *   node scripts/telnyx-official-baseline-866.mjs
 *   node scripts/telnyx-official-baseline-866.mjs --create-only
 *   node scripts/telnyx-official-baseline-866.mjs --verify-secret
 *   node scripts/telnyx-official-baseline-866.mjs --model google/gemini-2.5-flash-lite
 *   node scripts/telnyx-official-baseline-866.mjs --switch-model google/gemini-2.5-flash-lite
 *   node scripts/telnyx-official-baseline-866.mjs --switch-model anthropic/claude-haiku-4-5
 *   node scripts/telnyx-official-baseline-866.mjs --verify <assistantId>
 *   node scripts/telnyx-official-baseline-866.mjs --restore <snapshot.json>
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const OUT_DIR = process.env.BASELINE_OUT || "/opt/cursor/artifacts/telnyx-official-baseline";
const DEFAULT_ASSISTANT =
  process.env.BASELINE_ASSISTANT_ID ||
  "assistant-f2a573af-dde1-4441-a6f1-846aeccc1020";
const GEMINI_KEY_REF = process.env.GEMINI_API_KEY_REF || "gemini_api_key";

const CREATE_ONLY = process.argv.includes("--create-only");
const VERIFY_SECRET = process.argv.includes("--verify-secret");
const VERIFY_IDX = process.argv.indexOf("--verify");
const RESTORE_IDX = process.argv.indexOf("--restore");
const MODEL_IDX = process.argv.indexOf("--model");
const SWITCH_IDX = process.argv.indexOf("--switch-model");
const ASSISTANT_IDX = process.argv.indexOf("--assistant");

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

  if (VERIFY_SECRET) {
    const out = await post(jar, { action: "verify_secret" });
    console.log(JSON.stringify(out.json, null, 2));
    process.exit(out.ok && out.json?.data?.exists ? 0 : 1);
  }

  if (SWITCH_MODEL) {
    const assistantId = resolveAssistantId();
    console.log(`Switching ${assistantId} → ${SWITCH_MODEL} (key=${GEMINI_KEY_REF})`);
    const out = await post(jar, {
      action: "switch_model",
      assistantId,
      modelId: SWITCH_MODEL,
    });
    if (!out.ok) {
      console.error("FAIL", out.status, JSON.stringify(out.json).slice(0, 2000));
      process.exit(1);
    }
    save(`switch-${SWITCH_MODEL.replace(/\//g, "_")}.json`, out.json);
    console.log(JSON.stringify(out.json?.data, null, 2));
    console.log(`\nCall ${E164} to test ${SWITCH_MODEL}.`);
    process.exit(0);
  }

  if (VERIFY_IDX >= 0) {
    const assistantId = process.argv[VERIFY_IDX + 1] || resolveAssistantId();
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
  console.log(
    `Calling ${BASE} action=${action} e164=${E164}` +
      (MODEL_ARG ? ` model=${MODEL_ARG}` : ""),
  );
  const out = await post(jar, {
    action,
    ...(MODEL_ARG ? { modelId: MODEL_ARG } : {}),
  });
  if (!out.ok) {
    console.error("FAIL", out.status, JSON.stringify(out.json).slice(0, 2000));
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

  console.log("\n=== TELNYX ULTRA-LOW-LATENCY BASELINE ===");
  console.log("assistantId:", d.assistantId);
  console.log("activeVersionId:", d.activeVersionId);
  console.log("preferredModel:", d.preferredModel);
  console.log("usedModel:", d.usedModel);
  console.log("geminiKeyRef:", d.geminiKeyRef);
  console.log("modelNote:", d.modelNote);
  console.log("modelAttempts:", JSON.stringify(d.modelAttempts));
  console.log("model live:", d.live?.model);
  console.log("llm_api_key_ref live:", d.live?.llm_api_key_ref ?? null);
  console.log("stt live:", d.live?.transcription?.model);
  console.log(
    "stt settings (Telnyx-inserted):",
    JSON.stringify(d.live?.transcription?.settings),
  );
  console.log("voice live:", d.live?.voice_settings?.voice);
  console.log(
    "tools:",
    Array.isArray(d.live?.tools) ? d.live.tools.length : d.providerInserted?.tool_count,
  );
  console.log("dynvar webhook:", d.live?.dynamic_variables_webhook_url ?? null);
  if (d.route?.route) {
    console.log("\nROUTE:", d.route.route.path);
    console.log("matched:", d.route.route.matched);
  }
  console.log(`\nCall ${E164} now. Measure caller-end → first assistant audio.`);
  console.log(
    "Switch models later:\n  node scripts/telnyx-official-baseline-866.mjs --switch-model google/gemini-2.5-flash-lite\n  node scripts/telnyx-official-baseline-866.mjs --switch-model anthropic/claude-haiku-4-5",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
