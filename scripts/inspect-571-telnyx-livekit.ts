/**
 * Read-only Telnyx + LiveKit SIP state for Phase 54 (+15717491060).
 */
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import {
  resolveTelnyxIngressLiveKitSipHost,
  TRANSOVO_TELNYX_FQDN_CONNECTION_NAME,
} from "../src/lib/telephony/provisioning/config";
import {
  diagnoseLiveKitSipIssues,
  inspectLiveKitSipRouting,
} from "../src/lib/telephony/provisioning/livekit/inspect";
import { findFqdnConnectionByName } from "../src/lib/telephony/provisioning/telnyx/sip-connection";

const E164 = (process.env.PHONE_E164 || "+15717491060").trim();

async function main() {
  process.env.MEDIA_BACKEND_MODE = "livekit_cloud";

  const inspect = await inspectLiveKitSipRouting(E164);
  const issues = diagnoseLiveKitSipIssues(inspect, E164);
  const ingress = resolveTelnyxIngressLiveKitSipHost();
  const pn = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164, "page[size]": 1 } },
  );
  const fqdnConn = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  let fqdns: Array<{ id: string; fqdn: string; port: unknown }> = [];
  if (fqdnConn?.id) {
    const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
      "/fqdns",
      { query: { "filter[connection_id]": String(fqdnConn.id) } },
    );
    fqdns = (listed.data || []).map((r) => ({
      id: String(r.id),
      fqdn: String(r.fqdn),
      port: r.port,
    }));
  }

  console.log(
    JSON.stringify(
      {
        e164: E164,
        ingress,
        telnyxNumber: pn.data?.[0]
          ? {
              id: pn.data[0].id,
              connection_id: pn.data[0].connection_id,
              connection_name: pn.data[0].connection_name,
              status: pn.data[0].status,
            }
          : null,
        fqdnConn: fqdnConn
          ? { id: fqdnConn.id, name: fqdnConn.connection_name }
          : null,
        fqdns,
        livekit: inspect,
        issues,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
