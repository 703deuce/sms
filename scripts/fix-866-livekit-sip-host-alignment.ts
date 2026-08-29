/**
 * Fix 866 inbound: Telnyx primary FQDN must match LIVEKIT_URL Cloud project,
 * not voice.transovo.ai or amy-4hde63ww.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/fix-866-livekit-sip-host-alignment.ts
 */
import {
  getLiveKitProjectAlignment,
  resolveTelnyxIngressLiveKitSipHost,
} from "../src/lib/telephony/provisioning/config";
import { ensureTelnyxLiveKitFqdnConnection } from "../src/lib/telephony/provisioning/telnyx/sip-connection";
import {
  ensureNumberProvisioned,
  repairLiveKitSipRouting,
} from "../src/lib/telephony/provisioning";
import { patchInboundTrunkE164Formats } from "../src/lib/telephony/provisioning/livekit/patch-trunk-e164";
import { getPrisma } from "../src/lib/db";

const E164 = process.env.PHONE_E164 || "+18663464256";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID || "cmsc3numa1j17084g391t2z5l";
const AGENT_ID =
  process.env.AGENT_ID || "cmsdkcnwr5p3i5s0h3i1x0j60";

async function main() {
  console.log("LiveKit alignment:", getLiveKitProjectAlignment());
  console.log("Telnyx ingress host:", resolveTelnyxIngressLiveKitSipHost());

  const fqdn = await ensureTelnyxLiveKitFqdnConnection();
  console.log("FQDN actions:", fqdn.actions);

  const repair = await repairLiveKitSipRouting({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_NUMBER_ID,
    agentId: AGENT_ID,
  });
  console.log("repair ok:", repair.ok);
  console.log("trunk:", repair.after.trunkContainingDid?.id, repair.after.trunkContainingDid?.numbers);

  const patch = await patchInboundTrunkE164Formats(E164);
  console.log("trunk numbers:", patch.numbers);

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { publishedVersionId: true },
  });
  await ensureNumberProvisioned({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_NUMBER_ID,
    agentId: AGENT_ID,
    routingMode: "livekit_sip",
    publishedVersionId: agent?.publishedVersionId,
  });

  console.log("\n=== FIXED ===");
  console.log(`Call ${E164}`);
  console.log(`Telnyx primary FQDN should be sms-6w01zoya.sip.livekit.cloud (not voice.transovo.ai)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
