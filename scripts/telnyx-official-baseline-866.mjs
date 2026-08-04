/**
 * Create Telnyx-direct ultra-low-latency baseline and (optionally) route +1866.
 *
 *   node scripts/telnyx-official-baseline-866.mjs
 *   node scripts/telnyx-official-baseline-866.mjs --create-only
 *   node scripts/telnyx-official-baseline-866.mjs --verify <assistantId>
 *   node scripts/telnyx-official-baseline-866.mjs --restore <snapshot.json>
 */
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const OUT_DIR = process.env.BASELINE_OUT || "/opt/cursor/artifacts/telnyx-official-baseline";

const CREATE_ONLY = process.argv.includes("--create-only");
const VERIFY_IDX = process.argv.indexOf("--verify");
const RESTORE_IDX = process.argv.indexOf("--restore");

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
    body: JSON.stringify({ ...body, workspaceId: "ws_1", e164: E164 }),
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

  if (VERIFY_IDX >= 0) {
    const assistantId = process.argv[VERIFY_IDX + 1];
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
  const out = await post(jar, { action });
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
  console.log("model live:", d.live?.model);
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
  console.log(
    "start_speaking_plan:",
    JSON.stringify(d.providerInserted?.start_speaking_plan),
  );
  console.log("diffs:", JSON.stringify(d.diffs, null, 2));
  if (d.route?.route) {
    console.log("\nROUTE:", d.route.route.path);
    console.log("matched:", d.route.route.matched);
  }
  console.log(`\nCall ${E164} now. Measure caller-end → first assistant audio.`);
  console.log(
    "Restore later with: node scripts/telnyx-official-baseline-866.mjs --restore",
    join(OUT_DIR, "snapshot.json"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
