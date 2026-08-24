#!/usr/bin/env npx tsx
/** Deep Telnyx SIP trace for 571 — includes dst IP and failure detail fields. */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";

const e164 = process.argv.find((a) => a.startsWith("+")) || MCTB_PLATFORM_DEMO_E164;

async function main() {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[cld]": e164,
      "page[size]": 5,
    },
  });

  const keys = [
    "started_at",
    "finished_at",
    "hangup_cause",
    "sip_invite_failure_status",
    "sip_response_code",
    "sip_hangup_cause",
    "connection_name",
    "src_ip",
    "dst_ip",
    "route",
    "tags",
    "user_dtmf",
    "pdd",
    "call_sec",
    "cli",
    "cld",
    "direction",
  ];

  for (const r of res.data || []) {
    const row: Record<string, unknown> = {};
    for (const k of keys) if (r[k] != null && r[k] !== "") row[k] = r[k];
    console.log(JSON.stringify(row, null, 2));
    console.log("---");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
