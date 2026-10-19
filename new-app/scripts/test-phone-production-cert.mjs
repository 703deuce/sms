#!/usr/bin/env node
/**
 * Backend certification for Phone APIs (run against production or staging).
 *
 * Usage:
 *   PHONE_TEST_BASE_URL=https://transovo.ai node new-app/scripts/test-phone-production-cert.mjs
 *   PHONE_TEST_CALL_ID=cmvf8... (optional — defaults to first call with recording=true)
 */
const base = (process.env.PHONE_TEST_BASE_URL || "https://transovo.ai").replace(/\/$/, "");

async function get(path) {
  const res = await fetch(`${base}${path}`);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json, res };
}

async function head(path) {
  const res = await fetch(`${base}${path}`, { method: "HEAD" });
  return { ok: res.ok, status: res.status, res };
}

function fail(msg) {
  console.error("FAIL", msg);
  process.exitCode = 1;
}

function pass(msg) {
  console.log("PASS", msg);
}

async function main() {
  const health = await get("/api/health");
  if (!health.ok || !health.json.ok) {
    fail(`health ${health.status}`);
    return;
  }
  pass(`health commitSha=${String(health.json.commitSha || "").slice(0, 12)}`);

  const readiness = await get("/api/phone/readiness");
  if (!readiness.ok) {
    fail("readiness");
    return;
  }
  const r = readiness.json.data || {};
  if (!r.telnyxConfigured) fail("readiness.telnyxConfigured");
  else pass("readiness telnyx");
  if (!r.webrtcCredentialConfigured) fail("readiness.webrtcCredentialConfigured");
  else pass("readiness webrtc credential");

  const token = await get("/api/phone/webrtc-token");
  if (!token.ok || token.json.data?.mode !== "telnyx" || !token.json.data?.loginToken) {
    fail("webrtc-token");
    return;
  }
  pass("webrtc-token");

  const webhook = await get("/api/telnyx/phone");
  if (!webhook.ok || !webhook.json.ok) fail("telnyx-phone-webhook GET");
  else pass("telnyx-phone-webhook GET");

  const endpoints = [
    "/api/phone/settings",
    "/api/phone/calls?limit=3",
    "/api/phone/routing",
    "/api/phone/routing?part=hours",
    "/api/phone/analytics?range=7d",
    "/api/phone/transfer-targets",
    "/api/phone/power-dialer/campaigns",
    "/api/phone/power-dialer/lists",
  ];
  for (const path of endpoints) {
    const res = await get(path);
    if (!res.ok) fail(path);
    else pass(path);
  }

  let callId = process.env.PHONE_TEST_CALL_ID?.trim();
  if (!callId) {
    const list = await get("/api/phone/calls?limit=20");
    const row = (list.json.data || []).find((c) => c.recording);
    callId = row?.id;
  }
  if (!callId) {
    fail("no call with recording in list — set PHONE_TEST_CALL_ID");
    return;
  }

  const detail = await get(`/api/phone/calls/${encodeURIComponent(callId)}`);
  if (!detail.ok) {
    fail(`call detail ${callId}`);
    return;
  }
  pass(`call detail ${callId}`);

  const rec = await get(`/api/phone/calls/${encodeURIComponent(callId)}/recording`);
  if (!rec.ok || !rec.json.data?.url) {
    fail(`recording JSON ${callId}`);
    return;
  }
  pass(`recording JSON ${callId}`);

  const streamHead = await head(`/api/phone/calls/${encodeURIComponent(callId)}/recording/stream`);
  if (!streamHead.ok) {
    fail(`recording stream HEAD ${callId} HTTP ${streamHead.status}`);
    return;
  }
  pass(`recording stream HEAD ${callId}`);

  const streamGet = await fetch(`${base}/api/phone/calls/${encodeURIComponent(callId)}/recording/stream`, {
    headers: { Range: "bytes=0-1023" },
  });
  if (!streamGet.ok && streamGet.status !== 206) {
    fail(`recording stream GET ${callId} HTTP ${streamGet.status}`);
    return;
  }
  const buf = await streamGet.arrayBuffer();
  if (buf.byteLength < 1) {
    fail(`recording stream empty body ${callId}`);
    return;
  }
  pass(`recording stream GET ${callId} bytes=${buf.byteLength}`);

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
  console.log("\nPhone backend cert: ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
