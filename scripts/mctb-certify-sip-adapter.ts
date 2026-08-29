#!/usr/bin/env npx tsx
/**
 * Certification checklist for MCTB Asterisk SIP adapter vs LiveKit baseline.
 * Does not capture live SIP — prints the gate matrix and recent Telnyx CDR hints.
 *
 *   npx tsx scripts/mctb-certify-sip-adapter.ts --e164 +18663464256
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";

const e164 = process.argv.find((a) => a.startsWith("+")) || "+18663464256";

const SIP_SEQUENCE = [
  "INVITE",
  "100 Trying",
  "183 Session Progress (or 180 Ringing)",
  "Require/Supported: 100rel (if offered)",
  "PRACK",
  "200 PRACK",
  "200 INVITE",
  "ACK",
  "RTP (early or post-answer)",
  "DTMF (RFC2833 or inband)",
  "BYE",
];

async function main() {
  console.log("MCTB SIP adapter certification gates\n");
  console.log("Gate 1 — SIP signaling (AT&T conditional forward keeps leg alive)");
  console.log("  Compare LiveKit baseline pcap vs Asterisk replacement pcap:");
  for (const step of SIP_SEQUENCE) {
    console.log(`    [ ] ${step}`);
  }
  console.log("");
  console.log("Gate 2 — Business path (unchanged backend)");
  console.log("  [ ] resolve_mctb_sip_session → workspace + playUrl");
  console.log("  [ ] press-1 → record_mctb_sip_press_1_consent");
  console.log("  [ ] metadata.path = asterisk_sip_mctb");
  console.log("  [ ] SMS scheduled for ws_1");
  console.log("");
  console.log("Gate 3 — Repeatability");
  console.log("  [ ] 10/10 conditional-forward calls: CDR duration > 5s, no SIP 480");
  console.log("");

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/detail_records",
    {
      query: {
        "filter[record_type]": "sip-trunking",
        "filter[cld]": e164.replace(/\D/g, ""),
        "page[size]": 5,
      },
    },
  ).catch(() => ({ data: [] as Array<Record<string, unknown>> }));

  const rows = listed.data || [];
  if (rows.length) {
    console.log(`Recent sip-trunking CDRs for ${e164} (newest first):`);
    for (const row of rows) {
      console.log(
        `  ${row.started_at || row.created_at} duration=${row.call_sec ?? row.duration}s hangup=${row.sip_hangup_cause || row.hangup_cause}`,
      );
    }
  } else {
    console.log(`No recent sip-trunking CDRs found for ${e164} (run a test call first).`);
  }

  console.log("\nCapture tips:");
  console.log("  tcpdump -i any -w /tmp/mctb-sip.pcap udp port 5060 or host <telnyx-signaling-ip>");
  console.log("  asterisk -rx 'pjsip set logger on'");
  console.log("  grep asterisk_sip_mctb in transovo-web logs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
