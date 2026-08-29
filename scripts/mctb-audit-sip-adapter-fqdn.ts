#!/usr/bin/env npx tsx
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_571_SIP_FQDN_CONNECTION_ID } from "@/lib/mctb/sip-diagnostic/constants";

async function main() {
  const id = MCTB_571_SIP_FQDN_CONNECTION_ID;
  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": id, "page[size]": 20 },
  });
  const conn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(id)}`,
  );
  const primary = String(
    (conn.data?.inbound as Record<string, unknown> | undefined)?.default_primary_fqdn_id || "",
  );
  for (const row of fqdns.data || []) {
    console.log(
      JSON.stringify({
        id: row.id,
        fqdn: row.fqdn,
        port: row.port,
        primary: String(row.id) === primary,
      }),
    );
  }
  const pn = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": "+18663464256", "page[size]": 1 },
  });
  console.log(
    "866:",
    pn.data?.[0]?.connection_id,
    pn.data?.[0]?.connection_name,
  );
}

main();
