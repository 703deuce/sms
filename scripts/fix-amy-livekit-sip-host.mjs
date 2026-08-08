#!/usr/bin/env node
/**
 * Point Telnyx +18663464256 at the correct LiveKit SIP host (amy project).
 * Coolify must also use the matching LIVEKIT_URL + API keys for the same project.
 *
 *   AMY_LIVEKIT_SIP_HOST=amy-4hde63ww.sip.livekit.cloud node scripts/fix-amy-livekit-sip-host.mjs
 */
const AMY_SIP_HOST = (
  process.env.AMY_LIVEKIT_SIP_HOST || "amy-4hde63ww.sip.livekit.cloud"
).trim();
const LIVEKIT_CONN_ID =
  process.env.TELNYX_LIVEKIT_FQDN_CONNECTION_ID || "3022029259041408870";
const PHONE_ID = process.env.PHONE_866_PROVIDER_ID || "3015888798992041067";
const E164 = process.env.PHONE_E164 || "+18663464256";

async function main() {
  const key = process.env.TELNYX_API_KEY?.trim();
  if (!key) throw new Error("TELNYX_API_KEY required");

  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "content-type": "application/json",
  };

  async function tx(path, opts = {}) {
    const url =
      "https://api.telnyx.com/v2" +
      path +
      (opts.query ? "?" + new URLSearchParams(opts.query) : "");
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json)}`);
    return json;
  }

  // Ensure FQDN record exists
  const fqdns = await tx("/fqdns", {
    query: { "filter[connection_id]": LIVEKIT_CONN_ID },
  });
  let fqdn = (fqdns.data || []).find(
    (r) => String(r.fqdn || "").toLowerCase() === AMY_SIP_HOST.toLowerCase(),
  );
  if (!fqdn) {
    const created = await tx("/fqdns", {
      method: "POST",
      body: {
        connection_id: LIVEKIT_CONN_ID,
        fqdn: AMY_SIP_HOST,
        port: 5060,
        dns_record_type: "a",
      },
    });
    fqdn = created.data;
    console.log("created fqdn", fqdn?.id, AMY_SIP_HOST);
  }

  await tx(`/fqdn_connections/${LIVEKIT_CONN_ID}`, {
    method: "PATCH",
    body: {
      inbound: { default_primary_fqdn_id: String(fqdn.id) },
    },
  });
  console.log("set primary fqdn", fqdn.id, AMY_SIP_HOST);

  await tx(`/phone_numbers/${PHONE_ID}`, {
    method: "PATCH",
    body: { connection_id: LIVEKIT_CONN_ID },
  });
  const phone = await tx(`/phone_numbers/${PHONE_ID}`);
  console.log("phone routed:", phone.data?.connection_name, E164);

  console.log("\nNext: set Coolify LIVEKIT_URL=wss://amy-4hde63ww.livekit.cloud");
  console.log("      LIVEKIT_SIP_URI=amy-4hde63ww.sip.livekit.cloud");
  console.log("      LIVEKIT_API_KEY + LIVEKIT_API_SECRET from amy project, redeploy, Publish Amy");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
