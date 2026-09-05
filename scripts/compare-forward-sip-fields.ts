import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const NUMBERS = [
  { label: "new571_fail_forward", e164: "+15717491060", at: "2026-09-05T16:34:54Z" },
  { label: "new571_ok_direct", e164: "+15717491060", at: "2026-09-05T16:24:18Z" },
  { label: "866_ok_forward", e164: "+18663464256", at: "2026-08-30T02:34:41Z" },
];

const FIELDS = [
  "started_at",
  "call_sec",
  "sip_invite_failure_status",
  "sip_full_to",
  "sip_from_url",
  "orig_jip",
  "answered_at",
  "call_control_id",
  "connected",
  "completed",
  "shaken_stir",
  "connection_name",
  "connection_id",
  "e164_div",
  "cf_number",
  "caller_name",
  "telnyx_error_code",
];

async function main() {
  for (const target of NUMBERS) {
    const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
      query: {
        "filter[record_type]": "sip-trunking",
        "filter[cld]": target.e164,
        "page[size]": 20,
      },
    });
    const row = (res.data || []).find((r) => String(r.started_at) === target.at);
    const out: Record<string, unknown> = { label: target.label };
    for (const k of FIELDS) if (row?.[k] != null && row[k] !== "") out[k] = row[k];
    console.log(JSON.stringify(out, null, 2));
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
