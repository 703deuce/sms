#!/usr/bin/env npx tsx
/**
 * Repair self-hosted LiveKit inbound trunk Telnyx signaling allowlist.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' MEDIA_BACKEND_MODE=self_hosted \
 *     npx tsx scripts/fix-self-hosted-trunk-telnyx-allowlist.ts
 *   ... --apply
 */
import { getActiveMediaBackend, getLiveKitBackendConfig } from "@/lib/voice/media-backend";
import { ensureTelnyxSignalingAllowlist } from "@/lib/telephony/provisioning/livekit/telnyx-allowlist";
import { missingTelnyxSignalingIps } from "@/lib/telephony/provisioning/livekit/telnyx-allowlist";
import { getLiveKitSipClient } from "@/lib/telephony/provisioning/livekit/client";

const apply = process.argv.includes("--apply");

async function main() {
  const backend = getActiveMediaBackend();
  const cfg = getLiveKitBackendConfig(backend);
  const trunkId = cfg.inboundTrunkId;
  if (!trunkId) {
    throw new Error(`No inbound trunk id configured for backend ${backend}`);
  }

  const client = getLiveKitSipClient(backend);
  const listed = await client.listSipInboundTrunk({ trunkIds: [trunkId] });
  const trunk = listed[0];
  if (!trunk) throw new Error(`Trunk ${trunkId} not found on ${backend}`);

  const allowed =
    (trunk as { allowedAddresses?: string[] }).allowedAddresses ||
    (trunk as { allowed_addresses?: string[] }).allowed_addresses ||
    [];

  console.log(
    JSON.stringify(
      {
        apply,
        backend,
        trunkId,
        trunkName: trunk.name,
        numbers: trunk.numbers,
        allowedAddresses: allowed,
        missingTelnyxIps: missingTelnyxSignalingIps(allowed),
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("\nDry run — pass --apply to patch missing Telnyx signaling IPs.");
    return;
  }

  const result = await ensureTelnyxSignalingAllowlist({ trunkId, backend });
  console.log("\nPatch result:", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
