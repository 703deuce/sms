/**
 * Diagnose Voice V3 Basic Telnyx routing for +15717491060.
 */
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const E164 = process.env.PHONE_E164?.trim() || "+15717491060";

async function main() {
  const pnRes = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": E164, "page[size]": 5 },
  });
  const pn = pnRes.data?.[0];
  if (!pn) {
    console.log("NO_PHONE", E164);
    return;
  }
  const connId = String(pn.connection_id || "");
  console.log("PHONE", {
    id: pn.id,
    e164: pn.phone_number,
    status: pn.status,
    connection_id: connId,
    connection_name: pn.connection_name,
  });

  if (!connId) return;

  for (const path of [`/fqdn_connections/${connId}`, `/call_control_applications/${connId}`]) {
    try {
      const res = await telnyxRequest<{ data?: Record<string, unknown> }>(path);
      console.log("CONN_DETAIL", path, JSON.stringify(res.data, null, 2));
    } catch (e) {
      console.log("CONN_MISS", path, String(e));
    }
  }

  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": connId },
  });
  console.log("FQDNS", JSON.stringify(fqdns.data, null, 2));

  const cdr = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[date_range]": "last_24h",
      "page[size]": 20,
    },
  });
  const rows = (cdr.data || []).filter((r) => JSON.stringify(r).includes("5717491060"));
  console.log("RECENT_CDR_571", JSON.stringify(rows.slice(0, 5), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
