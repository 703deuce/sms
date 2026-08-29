import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getAuthoritativeLiveKitSipHost } from "../src/lib/telephony/provisioning/config";

const e164 = "+15714073615";

async function main() {
  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": e164, "page[size]": 1 } },
  );
  const pn = listed.data?.[0];
  if (!pn) {
    console.log("NOT FOUND in Telnyx");
    return;
  }
  const connId = String(pn.connection_id || "");
  const [voice, fqdns, conn, cdrs] = await Promise.all([
    telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(String(pn.id))}/voice`,
    ).catch(() => ({ data: null })),
    connId
      ? telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
          query: { "filter[connection_id]": connId },
        })
      : Promise.resolve({ data: [] }),
    connId
      ? telnyxRequest<{ data?: Record<string, unknown> }>(
          `/fqdn_connections/${encodeURIComponent(connId)}`,
        )
      : Promise.resolve({ data: null }),
    telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
      query: {
        "filter[phone_number]": e164,
        "filter[record_type]": "sip-trunking",
        "page[size]": 5,
      },
    }).catch(() => ({ data: [] })),
  ]);

  const sipHost = getAuthoritativeLiveKitSipHost();
  console.log(
    JSON.stringify(
      {
        telnyx: {
          id: pn.id,
          status: pn.status,
          connection_id: pn.connection_id,
          connection_name: pn.connection_name,
        },
        voice: voice.data,
        connActive: conn.data?.active,
        connPrimaryFqdn: (conn.data?.inbound as Record<string, unknown> | undefined)
          ?.default_primary_fqdn_id,
        fqdns: (fqdns.data || []).map((f) => ({ fqdn: f.fqdn, port: f.port, id: f.id })),
        expectedSipHost: sipHost,
        recentSipRecords: (cdrs.data || []).slice(0, 3).map((r) => ({
          created_at: r.created_at,
          finished_at: r.finished_at,
          direction: r.direction,
          hangup_cause: r.hangup_cause,
          sip_hangup_cause: r.sip_hangup_cause,
          cli: r.cli,
          cld: r.cld,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
