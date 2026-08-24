#!/usr/bin/env npx tsx
/**
 * Full MCTB 571 pipeline trace: Telnyx CDR + cloud vs self-hosted diff + ingress audit.
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_571_SIP_FQDN_CONNECTION_ID } from "@/lib/mctb/sip-diagnostic/constants";
import { SipClient } from "livekit-server-sdk";

const e164 = MCTB_PLATFORM_DEMO_E164;

function apiUrl(wss: string) {
  return wss.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

async function cloudClient() {
  const url = process.env.LIVEKIT_CLOUD_URL?.replace(/^["']|["']$/g, "");
  const key = process.env.LIVEKIT_CLOUD_API_KEY?.replace(/^["']|["']$/g, "");
  const secret = process.env.LIVEKIT_CLOUD_API_SECRET?.replace(/^["']|["']$/g, "");
  if (!url || !key || !secret) return null;
  return new SipClient(apiUrl(url), key, secret);
}

async function selfClient() {
  const url = process.env.LIVEKIT_SELF_HOSTED_URL?.replace(/^["']|["']$/g, "");
  const key = process.env.LIVEKIT_SELF_HOSTED_API_KEY?.replace(/^["']|["']$/g, "");
  const secret = process.env.LIVEKIT_SELF_HOSTED_API_SECRET?.replace(/^["']|["']$/g, "");
  if (!url || !key || !secret) return null;
  return new SipClient(apiUrl(url), key, secret);
}

async function main() {
  console.log("\n══ MCTB 571 pipeline trace ══\n");

  const cdr = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: { "filter[record_type]": "sip-trunking", "filter[cld]": e164, "page[size]": 3 },
  });
  console.log("Recent Telnyx SIP CDR:");
  for (const r of cdr.data || []) {
    console.log(
      `  ${r.started_at} ${r.hangup_cause} sip_fail=${r.sip_invite_failure_status || "-"} conn=${r.connection_name}`,
    );
  }

  const conn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(MCTB_571_SIP_FQDN_CONNECTION_ID)}`,
  );
  const primaryId = String(
    (conn.data?.inbound as Record<string, unknown> | undefined)?.default_primary_fqdn_id || "",
  );
  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": MCTB_571_SIP_FQDN_CONNECTION_ID, "page[size]": 20 },
  });
  const primary = (fqdns.data || []).find((r) => String(r.id) === primaryId);
  console.log(`\nTelnyx primary FQDN: ${primary?.fqdn || "(none)"}`);

  const cloud = await cloudClient();
  const self = await selfClient();
  if (cloud && self) {
    const ct = (await cloud.listSipInboundTrunk()).find((t) =>
      (t.numbers || []).includes(e164),
    );
    const st = (await self.listSipInboundTrunk()).find((t) =>
      (t.numbers || []).includes(e164),
    );
    console.log("\nCloud trunk (working baseline):");
    console.log(`  id=${ct?.sipTrunkId} allowed=${JSON.stringify(ct?.allowedAddresses || [])} codecs=${JSON.stringify((ct as { media?: unknown })?.media)}`);
    console.log("Self-hosted trunk (current):");
    console.log(`  id=${st?.sipTrunkId} allowed=${JSON.stringify(st?.allowedAddresses || [])} codecs=${JSON.stringify((st as { media?: unknown })?.media)}`);
  }

  console.log("\nInterpretation:");
  console.log("  - NORMAL_CLEARING + call_sec>0 = call reached LiveKit and completed");
  console.log("  - PROGRESS_TIMEOUT = Telnyx got no 180/183 from SIP destination in time");
  console.log(
    "  - Last known good: 2026-08-24T05:14 UTC (before FQDN primary switched to self-hosted SIP host)", // pragma: allowlist secret
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
