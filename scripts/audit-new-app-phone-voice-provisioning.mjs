#!/usr/bin/env node
/**
 * Audit Telnyx voice provisioning for new-app browser phone (Call Control + WebRTC).
 *
 * Telnyx model:
 * - Voice DID → Call Control application (webhook → /api/telnyx/phone)
 * - Browser → telephony credential + JWT (one credential per logged-in agent)
 * - Inbound: answer PSTN leg, transfer to sip:<credential_sip_username>@sip.telnyx.com;secure=srtp
 *
 * Usage: TELNYX_API_KEY=... TELNYX_CONNECTION_ID=... TELNYX_TELEPHONY_CREDENTIAL_ID=... node scripts/audit-new-app-phone-voice-provisioning.mjs
 */
const apiKey = process.env.TELNYX_API_KEY?.trim();
const ccAppId = process.env.TELNYX_CONNECTION_ID?.trim();
const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();
const checkE164 = process.env.PHONE_VOICE_E164?.trim() || "+18663464256";
const base = (process.env.TELNYX_API_BASE_URL || "https://api.telnyx.com/v2").replace(/\/$/, "");

if (!apiKey) {
  console.error("TELNYX_API_KEY required");
  process.exit(1);
}

async function telnyx(path) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json.data ?? json;
}

function parseConn(resourceId) {
  const m = String(resourceId || "").match(/^connection:(\d+)$/);
  return m?.[1] ?? null;
}

async function main() {
  console.log("=== New App Phone / Voice provisioning audit ===\n");

  if (!ccAppId) {
    console.log("FAIL: TELNYX_CONNECTION_ID (Call Control application id) is not set");
    process.exit(1);
  }

  const cc = await telnyx(`/call_control_applications/${encodeURIComponent(ccAppId)}`);
  console.log("Call Control app:", cc.application_name || cc.id, cc.id);
  console.log("  webhook:", cc.webhook_event_url);

  if (!credentialId) {
    console.log("\nFAIL: TELNYX_TELEPHONY_CREDENTIAL_ID is not set (browser cannot register)");
    process.exit(1);
  }

  const cred = await telnyx(`/telephony_credentials/${encodeURIComponent(credentialId)}`);
  const credConn = parseConn(cred.resource_id);
  console.log("\nTelephony credential:", cred.name, cred.id);
  console.log("  sip_username:", cred.sip_username);
  console.log("  resource_id:", cred.resource_id);
  if (credConn) {
    try {
      const sipConn = await telnyx(`/credential_connections/${encodeURIComponent(credConn)}`);
      console.log("  credential_connection:", sipConn.connection_name || sipConn.id);
    } catch {
      console.log("  credential_connection: (could not load", credConn, ")");
    }
  }

  if (credConn && credConn !== ccAppId) {
    console.log(
      "\nNOTE: WebRTC credential is on a SIP Credential Connection, not the Call Control app id.",
      "That is normal — inbound uses Call Control transfer to sip:username@sip.telnyx.com;secure=srtp.",
    );
  }

  const nums = await telnyx(
    `/phone_numbers?filter[phone_number]=${encodeURIComponent(checkE164)}`,
  );
  const row = Array.isArray(nums) ? nums[0] : nums?.data?.[0];
  if (!row) {
    console.log(`\nFAIL: Number ${checkE164} not found in account`);
    process.exit(1);
  }
  console.log(`\nNumber ${checkE164}:`);
  console.log("  connection_id:", row.connection_id);
  console.log("  on_call_control_app:", String(row.connection_id) === String(ccAppId));

  if (String(row.connection_id) !== String(ccAppId)) {
    console.log(
      "\nFAIL: This DID is not on the Call Control app used for /api/telnyx/phone.",
      "Run scripts/configure-new-app-telnyx-phone-webhook.mjs with PHONE_ATTACH_ONLY_E164S for voice lines only.",
    );
    process.exit(1);
  }

  if (!cred.sip_username) {
    console.log("\nFAIL: Telephony credential has no sip_username");
    process.exit(1);
  }

  console.log("\nPASS: Voice DID on Call Control + WebRTC credential with SIP username.");
  console.log(
    "Inbound path: webhook call.initiated → answer → transfer →",
    `sip:${cred.sip_username.slice(0, 8)}…@sip.telnyx.com;secure=srtp`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
