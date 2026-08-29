/**
 * Nuclear repair for persistent SIP 404 on +18663464256:
 * - Prune stale Telnyx FQDNs on LiveKit connection
 * - fullResetLiveKitSipRouting (wildcard Telnyx IP trunk + global dispatch)
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/fix-866-sip-404-full-reset.ts
 */
import {
  fullResetLiveKitSipRouting,
  inspectLiveKitSipRouting,
} from "../src/lib/telephony/provisioning";
import { pruneStaleTelnyxFqdns } from "../src/lib/telephony/provisioning/telnyx/sip-connection";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID || "cmsc3numa1j17084g391t2z5l";
const AGENT_ID =
  process.env.AGENT_ID || "cmsdkcnwr5p3i5s0h3i1x0j60";
const E164 = process.env.PHONE_E164 || "+18663464256";

async function main() {
  console.log("=== Pruning stale Telnyx FQDNs ===");
  const pruned = await pruneStaleTelnyxFqdns();
  console.log(JSON.stringify(pruned, null, 2));

  console.log("\n=== Before full reset ===");
  console.log(JSON.stringify(await inspectLiveKitSipRouting(E164), null, 2));

  console.log("\n=== Full reset LiveKit SIP ingress ===");
  const result = await fullResetLiveKitSipRouting({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_NUMBER_ID,
    agentId: AGENT_ID,
  });
  console.log("ok:", result.ok);
  console.log("actions:", result.actions);
  console.log("\n=== After full reset ===");
  console.log(JSON.stringify(result.after, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
