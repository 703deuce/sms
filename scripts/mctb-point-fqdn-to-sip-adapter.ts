#!/usr/bin/env npx tsx
/**
 * Point a Telnyx FQDN connection at the minimal MCTB SIP adapter (Asterisk sidecar).
 *
 * Test order: 866 toll-free first, then 571 platform number.
 *
 *   MCTB_SIP_ADAPTER_HOST=mctb-sip.example.com \
 *   EXTERNAL_SIP_IP=203.0.113.10 \
 *   npx tsx scripts/mctb-point-fqdn-to-sip-adapter.ts --e164 +18663464256
 *
 *   npx tsx scripts/mctb-point-fqdn-to-sip-adapter.ts --e164 +18663464256 --apply
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { assignE164ToConnection } from "@/lib/mctb/sip-diagnostic/fqdn-direct-setup";
import {
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_FQDN_DIRECT_TEST_E164,
} from "@/lib/mctb/sip-diagnostic/constants";
import { ensureMctb571SipFqdnLateMediaSettings } from "@/lib/mctb/sip-diagnostic/fqdn-audit";

const apply = process.argv.includes("--apply");

function readArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1]?.trim() || null;
}

async function ensureFqdnRecord(connectionId: string, sipHost: string): Promise<string> {
  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": connectionId, "page[size]": 20 },
  });
  const rows = listed.data || [];
  let target = rows.find((r) => String(r.fqdn || "").toLowerCase() === sipHost.toLowerCase());

  if (!target?.id) {
    if (!apply) {
      console.log(`Would create FQDN record ${sipHost} on connection ${connectionId}`);
      return "(dry-run)";
    }
    const created = await telnyxRequest<{ data?: Record<string, unknown> }>("/fqdns", {
      method: "POST",
      body: {
        connection_id: connectionId,
        fqdn: sipHost,
        port: Number(process.env.MCTB_SIP_UDP_PORT || 5060),
        dns_record_type: "a",
      },
    });
    target = created.data;
    console.log(`✓ Created FQDN record ${sipHost}`);
  }

  const fqdnId = String(target?.id || "");
  if (!fqdnId) throw new Error(`FQDN record missing for ${sipHost}`);

  const conn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(connectionId)}`,
  );
  const primaryId = String(
    (conn.data?.inbound as Record<string, unknown> | undefined)?.default_primary_fqdn_id || "",
  );

  if (primaryId !== fqdnId) {
    if (!apply) {
      console.log(`Would set primary FQDN → ${sipHost} (${fqdnId})`);
      return fqdnId;
    }
    await telnyxRequest(`/fqdn_connections/${encodeURIComponent(connectionId)}`, {
      method: "PATCH",
      body: {
        inbound: {
          default_primary_fqdn_id: fqdnId,
          default_secondary_fqdn_id: null,
          default_tertiary_fqdn_id: null,
        },
      },
    });
    console.log(`✓ Primary FQDN → ${sipHost}`);
  } else {
    console.log(`Primary FQDN already ${sipHost}`);
  }

  return fqdnId;
}

async function main() {
  const sipHost = (
    process.env.MCTB_SIP_ADAPTER_HOST ||
    process.env.MCTB_SIP_ADAPTER_SIP_HOST ||
    ""
  ).trim();
  if (!sipHost) {
    throw new Error("MCTB_SIP_ADAPTER_HOST is required (DNS A record → Hetzner public IP)");
  }

  const externalIp = process.env.EXTERNAL_SIP_IP?.trim() || null;
  const e164 = readArg("--e164") || MCTB_FQDN_DIRECT_TEST_E164;
  const connectionId = readArg("--connection-id") || MCTB_571_SIP_FQDN_CONNECTION_ID;

  console.log("MCTB SIP adapter FQDN cutover");
  console.log(`  apply:         ${apply}`);
  console.log(`  e164:          ${e164}`);
  console.log(`  connectionId:  ${connectionId}`);
  console.log(`  sipHost:       ${sipHost}`);
  console.log(`  externalIp:    ${externalIp || "(set EXTERNAL_SIP_IP on host)"}`);
  console.log("");

  const lateMedia = await ensureMctb571SipFqdnLateMediaSettings(connectionId);
  console.log("Late-media audit:");
  console.log(`  3PCC:     ${lateMedia.audit.thirdPartyControlEnabled}`);
  console.log(`  PRACK:    ${lateMedia.audit.prackEnabled}`);
  console.log(`  ringback: ${lateMedia.audit.generateRingbackTone}`);
  console.log(`  ready:    ${lateMedia.audit.lateMediaReady}`);
  if (lateMedia.patched) console.log("  (patched late-media flags)");
  console.log("");

  await ensureFqdnRecord(connectionId, sipHost);

  if (!apply) {
    console.log(`\nDry run — would assign ${e164} → FQDN connection ${connectionId}`);
    console.log("Pass --apply to execute.");
    return;
  }

  const assigned = await assignE164ToConnection(e164, connectionId);
  console.log(`✓ ${e164} assigned to connection ${assigned.liveConnectionId}`);

  console.log("\nNext:");
  console.log("  1. DNS A record for", sipHost, "→", externalIp || "Hetzner public IP");
  console.log("  2. docker compose -f docker-compose.mctb-sip-adapter.yml up -d --build");
  console.log("  3. Firewall: UDP/TCP 5060 + RTP 10000-10100");
  console.log("  4. 10× AT&T conditional-forward test — compare SIP trace to LiveKit baseline");
  console.log("  5. Only then point 571 platform number");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
