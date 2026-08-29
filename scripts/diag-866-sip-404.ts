/**
 * Diagnose persistent SIP 404 on +18663464256.
 */
import { inspectLiveKitSipRouting, diagnoseLiveKitSipIssues } from "../src/lib/telephony/provisioning/livekit/inspect";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { findFqdnConnectionByName } from "../src/lib/telephony/provisioning/telnyx/sip-connection";
import {
  TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
  getLiveKitProjectAlignment,
  resolveTelnyxIngressLiveKitSipHost,
} from "../src/lib/telephony/provisioning/config";

const E164 = "+18663464256";

async function main() {
  console.log("alignment:", getLiveKitProjectAlignment());
  console.log("ingress:", resolveTelnyxIngressLiveKitSipHost());

  const inspect = await inspectLiveKitSipRouting(E164);
  console.log("\n=== LiveKit SIP inspect ===");
  console.log(JSON.stringify(inspect, null, 2));
  console.log("issues:", diagnoseLiveKitSipIssues(inspect, E164));

  const nums = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164 } },
  );
  const phone = nums.data?.[0];
  console.log("\n=== Telnyx phone number ===");
  console.log(
    JSON.stringify(
      {
        id: phone?.id,
        status: phone?.status,
        connection_id: phone?.connection_id,
        connection_name: phone?.connection_name,
        messaging_profile_id: phone?.messaging_profile_id,
      },
      null,
      2,
    ),
  );

  const conn = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  const connId = String(conn?.id || "");
  const full = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(connId)}`,
  );
  const inbound = full.data?.inbound as Record<string, unknown> | undefined;
  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": connId },
  });
  const primaryId = String(inbound?.default_primary_fqdn_id || "");
  const primary = (fqdns.data || []).find((f) => String(f.id) === primaryId);
  console.log("\n=== FQDN connection ===");
  console.log(
    JSON.stringify(
      {
        connectionId: connId,
        primaryHost: primary?.fqdn,
        allFqdns: (fqdns.data || []).map((f) => ({ id: f.id, fqdn: f.fqdn })),
        inbound,
      },
      null,
      2,
    ),
  );

  const sip = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/detail_records",
    {
      query: {
        "filter[record_type]": "sip-trunking",
        "page[size]": 20,
        sort: "-created_at",
      },
    },
  );
  const recent = (sip.data || []).filter((r) => {
    const dest = String(r.dest_number || r.cld || "");
    return dest.includes("8663464256");
  });
  console.log("\n=== Recent SIP CDRs for 866 ===");
  for (const r of recent.slice(0, 8)) {
    console.log(
      JSON.stringify(
        {
          created_at: r.created_at,
          sip_response_code: r.sip_response_code,
          hangup_cause: r.hangup_cause,
          sip_hangup_cause: r.sip_hangup_cause,
          connection_name: r.connection_name,
          connection_id: r.connection_id,
          dest_number: r.dest_number,
          cld: r.cld,
          tags: r.tags,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
