#!/usr/bin/env node
/**
 * Enable inbound SIP URI → WebRTC credential (required for Call Control Dial to sip:username@sip.telnyx.com).
 * Telnyx: sip_uri_calling_preference must be "internal" or "unrestricted" (not disabled).
 *
 * Usage:
 *   TELNYX_API_KEY=... TELNYX_TELEPHONY_CREDENTIAL_ID=... node scripts/configure-new-app-telnyx-webrtc-sip-uri.mjs
 */
const apiKey = process.env.TELNYX_API_KEY?.trim();
const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();
const preference = process.env.TELNYX_SIP_URI_CALLING_PREFERENCE?.trim() || "internal";
const base = (process.env.TELNYX_API_BASE_URL || "https://api.telnyx.com/v2").replace(/\/$/, "");

if (!apiKey || !credentialId) {
  console.error("TELNYX_API_KEY and TELNYX_TELEPHONY_CREDENTIAL_ID required");
  process.exit(1);
}

async function telnyx(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json.data ?? json;
}

function parseConn(resourceId) {
  const m = String(resourceId || "").match(/^connection:(\d+)$/);
  return m?.[1] ?? null;
}

async function main() {
  const cred = await telnyx(`/telephony_credentials/${encodeURIComponent(credentialId)}`);
  const connId = parseConn(cred.resource_id);
  if (!connId) {
    console.error("FAIL: telephony credential has no connection resource_id");
    process.exit(1);
  }
  const before = await telnyx(`/credential_connections/${encodeURIComponent(connId)}`);
  console.log("credential_connection:", connId, before.connection_name || "");
  console.log("  sip_uri_calling_preference (before):", before.sip_uri_calling_preference ?? "disabled/null");

  if (before.sip_uri_calling_preference === preference) {
    console.log("PASS: already", preference);
    return;
  }

  const after = await telnyx(`/credential_connections/${encodeURIComponent(connId)}`, {
    method: "PATCH",
    body: { sip_uri_calling_preference: preference },
  });
  console.log("  sip_uri_calling_preference (after):", after.sip_uri_calling_preference);
  if (after.sip_uri_calling_preference !== preference) {
    console.error("FAIL: patch did not apply");
    process.exit(1);
  }
  console.log("PASS: WebRTC credential connection accepts SIP URI calls from this Telnyx account.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
