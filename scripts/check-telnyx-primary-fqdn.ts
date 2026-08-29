import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { TRANSOVO_TELNYX_FQDN_CONNECTION_NAME } from "../src/lib/telephony/provisioning/config";
import { findFqdnConnectionByName } from "../src/lib/telephony/provisioning/telnyx/sip-connection";

async function main() {
  const conn = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  const id = String(conn?.id || "");
  const full = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(id)}`,
  );
  const inbound = full.data?.inbound as Record<string, unknown> | undefined;
  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": id },
  });
  const primaryId = String(inbound?.default_primary_fqdn_id || "");
  const primary = (fqdns.data || []).find((f) => String(f.id) === primaryId);
  console.log(
    JSON.stringify(
      {
        connectionId: id,
        primaryFqdnId: primaryId,
        primaryHost: primary?.fqdn,
        allFqdns: (fqdns.data || []).map((f) => ({ id: f.id, fqdn: f.fqdn })),
      },
      null,
      2,
    ),
  );
}

main();
