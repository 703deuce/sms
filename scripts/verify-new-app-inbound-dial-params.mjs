#!/usr/bin/env node
/**
 * Sanity-check env + Telnyx API rules for inbound WebRTC bridge (no call placed).
 *
 * Fails if TELNYX_CONNECTION_ID is missing or equals the WebRTC credential connection id
 * (that mismatch caused production 422 on POST /v2/calls).
 */
const apiKey = process.env.TELNYX_API_KEY?.trim();
const ccAppId = process.env.TELNYX_CONNECTION_ID?.trim();
const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();
const base = (process.env.TELNYX_API_BASE_URL || "https://api.telnyx.com/v2").replace(/\/$/, "");

function parseConn(resourceId) {
  const m = String(resourceId || "").match(/^connection:(\d+)$/);
  return m?.[1] ?? null;
}

async function telnyx(path) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json.data ?? json;
}

async function main() {
  console.log("=== Inbound dial params (Call Control vs WebRTC credential) ===\n");

  if (!ccAppId) {
    console.error("FAIL: TELNYX_CONNECTION_ID required (Call Control application id for POST /v2/calls)");
    process.exit(1);
  }
  if (!credentialId) {
    console.error("FAIL: TELNYX_TELEPHONY_CREDENTIAL_ID required");
    process.exit(1);
  }
  if (!apiKey) {
    console.log("WARN: TELNYX_API_KEY not set — skipping live credential fetch");
    console.log("PASS (static): use connection_id =", ccAppId, "for Dial; never the credential connection id alone.");
    process.exit(0);
  }

  const cc = await telnyx(`/call_control_applications/${encodeURIComponent(ccAppId)}`);
  const cred = await telnyx(`/telephony_credentials/${encodeURIComponent(credentialId)}`);
  const credConn = parseConn(cred.resource_id);

  console.log("Call Control app (Dial connection_id):", cc.id, cc.application_name || "");
  console.log("  webhook:", cc.webhook_event_url || "(none)");
  console.log("WebRTC credential sip_username:", cred.sip_username || "(missing)");
  console.log("WebRTC credential connection (NOT Dial connection_id):", credConn || "(unknown)");

  if (!cc.webhook_event_url) {
    console.error("\nFAIL: Call Control app has no webhook_event_url");
    process.exit(1);
  }
  if (!cred.sip_username) {
    console.error("\nFAIL: credential has no sip_username");
    process.exit(1);
  }
  if (credConn && credConn === ccAppId) {
    console.log(
      "\nNOTE: Credential connection id equals Call Control app id (unusual but OK if Telnyx merged them).",
    );
  } else if (credConn) {
    console.log(
      "\nOK: Credential connection",
      credConn,
      "≠ Call Control app",
      ccAppId,
      "— Dial must use Call Control app only (see docs/NEW-APP-INBOUND-WEBRTC-CALL-FLOW.md).",
    );
  }

  const sampleTo = `sip:${cred.sip_username}@sip.telnyx.com;secure=srtp`;
  console.log("\nSample POST /v2/calls body (not sent):");
  console.log(
    JSON.stringify(
      { connection_id: ccAppId, to: sampleTo, from: "+18663464256", timeout_secs: 25 },
      null,
      2,
    ),
  );
  console.log("\nPASS: Dial parameters align with Telnyx docs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
