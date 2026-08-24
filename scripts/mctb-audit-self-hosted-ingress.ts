#!/usr/bin/env npx tsx
/**
 * End-to-end read-only audit: Telnyx primary FQDN + self-hosted LiveKit trunk/dispatch for MCTB.
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_571_SIP_FQDN_CONNECTION_ID } from "@/lib/mctb/sip-diagnostic/constants";
import { getLiveKitSipClient } from "@/lib/telephony/provisioning/livekit/client";
import {
  diagnoseLiveKitSipIssues,
  inspectLiveKitSipRouting,
} from "@/lib/telephony/provisioning/livekit/inspect";
import { missingTelnyxSignalingIps } from "@/lib/telephony/provisioning/livekit/telnyx-allowlist";
import { TRANSOVO_LIVEKIT_AGENT_NAME } from "@/lib/telephony/provisioning/config";
import {
  getActiveMediaBackend,
  getLiveKitBackendConfig,
  resolveAuthoritativeLiveKitSipHost,
} from "@/lib/voice/media-backend";

const E164 = process.argv.find((a) => a.startsWith("+")) || "+15714073615";

async function main() {
  const backend = getActiveMediaBackend();
  const cfg = getLiveKitBackendConfig(backend);
  const sip = resolveAuthoritativeLiveKitSipHost();

  console.log("\n══ MCTB self-hosted ingress audit ══\n");
  console.log("Active backend:", backend);
  console.log("SIP host (authoritative):", sip.host, `(${sip.source})`);
  console.log("LiveKit URL:", cfg.url);
  console.log("Expected worker agent:", TRANSOVO_LIVEKIT_AGENT_NAME);

  const conn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(MCTB_571_SIP_FQDN_CONNECTION_ID)}`,
  );
  const inbound = (conn.data?.inbound || {}) as Record<string, unknown>;
  const primaryId = String(inbound.default_primary_fqdn_id || "");
  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": MCTB_571_SIP_FQDN_CONNECTION_ID, "page[size]": 20 },
  });
  const rows = fqdns.data || [];
  const primary = rows.find((r) => String(r.id) === primaryId);

  console.log("\nTelnyx FQDN connection:", MCTB_571_SIP_FQDN_CONNECTION_ID);
  console.log("  primary FQDN id:", primaryId || "(none)");
  console.log("  primary FQDN host:", primary?.fqdn || "(missing)");
  console.log(
    "  primary matches authoritative SIP:",
    String(primary?.fqdn || "").toLowerCase() === sip.host.toLowerCase() ? "YES" : "NO",
  );
  console.log("  all FQDN records:");
  for (const row of rows) {
    const marker = String(row.id) === primaryId ? " (PRIMARY)" : "";
    console.log(`    - ${row.fqdn}:${row.port}${marker}`);
  }

  const client = getLiveKitSipClient(backend);
  const trunks = await client.listSipInboundTrunk();
  const rules = await client.listSipDispatchRule();

  console.log(`\nLiveKit (${backend}) inbound trunks:`);
  for (const t of trunks) {
    console.log(`  ${t.sipTrunkId} ${t.name} numbers=${(t.numbers || []).join(",") || "(none)"}`);
  }

  console.log(`\nLiveKit (${backend}) dispatch rules:`);
  for (const r of rules) {
    const agent = r.roomConfig?.agents?.[0]?.agentName || "(none)";
    console.log(
      `  ${r.sipDispatchRuleId} ${r.name} trunks=${(r.trunkIds || []).join(",")} agent=${agent}`,
    );
  }

  const inspect = await inspectLiveKitSipRouting(E164);
  const issues = diagnoseLiveKitSipIssues(inspect, E164);
  console.log(`\nRouting inspect for ${E164}:`);
  console.log("  trunk:", inspect.trunkContainingDid?.id || "(none)");
  if (inspect.trunkContainingDid) {
    console.log("  trunk allowedAddresses:", inspect.trunkContainingDid.allowedAddresses.join(", ") || "(none)");
    const missingIps = missingTelnyxSignalingIps(inspect.trunkContainingDid.allowedAddresses);
    if (missingIps.length) {
      console.log("  missing Telnyx signaling IPs:", missingIps.join(", "));
    }
  }
  console.log("  dispatch rules for trunk:", inspect.dispatchRulesForTrunk.length);
  console.log("  issues:", issues.length ? issues.join(", ") : "(none)");

  const agentOk = rules.some(
    (r) =>
      (inspect.trunkContainingDid &&
        (r.trunkIds || []).includes(inspect.trunkContainingDid.id)) &&
      r.roomConfig?.agents?.[0]?.agentName === TRANSOVO_LIVEKIT_AGENT_NAME,
  );
  console.log("\nAssessment:");
  if (String(primary?.fqdn || "").toLowerCase() !== sip.host.toLowerCase()) {
    console.log("  FAIL: Telnyx primary FQDN is not the active SIP host — PSTN still routes elsewhere.");
    console.log("  Fix: run switch-active-media-backend-ingress.ts --apply with MEDIA_BACKEND_MODE=self_hosted");
  } else {
    console.log("  OK: Telnyx primary FQDN matches active SIP host.");
  }
  if (issues.some((i) => i.startsWith("telnyx_signaling_ip_missing"))) {
    console.log(
      "  FAIL: LiveKit trunk allowlist blocks Telnyx secondary signaling IP — PSTN invites are dropped.",
    );
    console.log(
      "  Fix: npx tsx scripts/fix-self-hosted-trunk-telnyx-allowlist.ts --apply (with MEDIA_BACKEND_MODE=self_hosted)",
    );
  } else if (issues.length) {
    console.log("  FAIL: LiveKit routing issues:", issues.join(", "));
  } else if (!agentOk) {
    console.log("  WARN: dispatch agent name may not match LIVEKIT_AGENT_NAME");
  } else {
    console.log("  OK: LiveKit trunk + dispatch look correct for", E164);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
