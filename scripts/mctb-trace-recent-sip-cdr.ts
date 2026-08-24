#!/usr/bin/env npx tsx
/** Recent Telnyx SIP CDR for MCTB 571 — diagnose hangup / SIP failure codes. */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";

const e164 = process.argv.find((a) => a.startsWith("+")) || MCTB_PLATFORM_DEMO_E164;

async function main() {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[cld]": e164,
      "page[size]": 10,
    },
  });

  const rows = res.data || [];
  console.log(`\nRecent SIP CDR for ${e164} (${rows.length} rows)\n`);
  if (!rows.length) {
    console.log("No SIP trunking CDR rows — call may not have reached Telnyx SIP layer.");
    return;
  }

  for (const r of rows) {
    console.log(
      JSON.stringify(
        {
          started: r.started_at,
          finished: r.finished_at,
          direction: r.direction,
          hangup_cause: r.hangup_cause,
          sip_invite_failure_status: r.sip_invite_failure_status,
          sip_response_code: r.sip_response_code,
          sip_hangup_cause: r.sip_hangup_cause,
          src_ip: r.src_ip,
          dst_ip: r.dst_ip,
          connection_name: r.connection_name,
          connection_id: r.connection_id,
          cli: r.cli,
          cld: r.cld,
        },
        null,
        2,
      ),
    );
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
