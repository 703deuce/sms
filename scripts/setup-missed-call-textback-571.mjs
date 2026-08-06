/**
 * Enable voice on +15714073615 and activate Missed Call Text Back (20s delay).
 *
 *   BASE_URL=https://transovo.ai node scripts/setup-missed-call-textback-571.mjs
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const PHONE_ID = (process.env.PHONE_NUMBER_ID || "cmsgtjms84g6l2h0o255w1e3v").trim();
const DELAY_SECONDS = Number(process.env.DELAY_SECONDS || 20);

async function smokeLogin() {
  const login = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: EMAIL }),
  });
  if (!login.ok) throw new Error(`smoke-login ${login.status}: ${await login.text()}`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => String(c).split(";")[0])
    .join("; ");
  return {
    cookie,
    h: {
      cookie,
      accept: "application/json",
      "content-type": "application/json",
    },
  };
}

async function provision(h, action) {
  const res = await fetch(`${BASE}/api/numbers/${PHONE_ID}/provision`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ action }),
  });
  const json = await res.json().catch(() => ({}));
  console.log(`provision ${action}`, res.status, JSON.stringify(json, null, 2));
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const { h } = await smokeLogin();

  console.log("\n=== diagnose ===");
  await provision(h, "diagnose");

  console.log("\n=== enable_voice ===");
  let voice = await provision(h, "enable_voice");
  if (!voice.ok) {
    console.log("\n=== repair ===");
    voice = await provision(h, "repair");
  }

  console.log("\n=== diagnose after voice ===");
  const after = await provision(h, "diagnose");

  console.log("\n=== missed-call-text-back activate ===");
  const mctb = await fetch(`${BASE}/api/solutions/missed-call-text-back`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      name: "Missed Call Text Back",
      phoneNumberId: PHONE_ID,
      initialDelayMinutes: 0,
      initialDelaySeconds: DELAY_SECONDS,
      firstMessage:
        "Sorry we missed your call. Reply to this text if you still need help.",
      replyWindowMinutes: 60,
      followUpEnabled: false,
      stopOnReply: true,
      activate: true,
    }),
  });
  const mctbJson = await mctb.json().catch(() => ({}));
  console.log("mctb", mctb.status, JSON.stringify(mctbJson, null, 2));

  console.log("\n=== GET missed-call-text-back ===");
  const get = await fetch(`${BASE}/api/solutions/missed-call-text-back`, {
    headers: h,
  });
  const getJson = await get.json().catch(() => ({}));
  console.log("get", get.status, JSON.stringify(getJson, null, 2));

  const readiness = after.json?.data || after.json || {};
  const channel = readiness.channelReadiness || readiness.channels || {};
  const summary = {
    base: BASE,
    phoneNumberId: PHONE_ID,
    voiceOk: voice.ok,
    voiceInboundConfigured:
      channel.voiceInboundConfigured ??
      readiness.voiceInboundConfigured ??
      null,
    connectionId:
      readiness.telnyx?.connectionId ||
      readiness.connectionId ||
      readiness.snapshot?.connectionId ||
      null,
    mctbOk: mctb.ok,
    mctbStatus: mctbJson?.data?.setup?.status || mctbJson?.data?.status || null,
    flowId: mctbJson?.data?.flowId || mctbJson?.flowId || null,
    delaySeconds: DELAY_SECONDS,
    callThisNumber: "+15714073615",
    expectSmsTo: "+15714776175",
  };
  console.log("\n=== READY SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  if (!voice.ok || !mctb.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
