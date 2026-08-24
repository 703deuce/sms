#!/usr/bin/env npx tsx
/**
 * Align self-hosted inbound trunk with working LiveKit Cloud trunk settings.
 * Cloud trunk: no IP allowlist, all codecs allowed.
 *
 * Usage:
 *   MEDIA_BACKEND_MODE=self_hosted npx tsx scripts/fix-self-hosted-trunk-match-cloud.ts --apply
 */
import { ListUpdate, SIPMediaConfig } from "@livekit/protocol";
import { getActiveMediaBackend, getLiveKitBackendConfig } from "@/lib/voice/media-backend";
import { getLiveKitSipClient } from "@/lib/telephony/provisioning/livekit/client";

const apply = process.argv.includes("--apply");

async function main() {
  const backend = getActiveMediaBackend();
  if (backend !== "self_hosted") {
    console.warn(`Expected MEDIA_BACKEND_MODE=self_hosted (got ${backend})`);
  }

  const cfg = getLiveKitBackendConfig("self_hosted");
  const trunkId = cfg.inboundTrunkId;
  if (!trunkId) throw new Error("LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID missing");

  const client = getLiveKitSipClient("self_hosted");
  const listed = await client.listSipInboundTrunk({ trunkIds: [trunkId] });
  const trunk = listed[0];
  if (!trunk) throw new Error(`Trunk ${trunkId} not found`);

  const before = {
    allowed: (trunk as { allowedAddresses?: string[] }).allowedAddresses || [],
    media: (trunk as { media?: SIPMediaConfig }).media,
  };

  const target = {
    allowedAddresses: [] as string[],
    media: new SIPMediaConfig({ onlyListedCodecs: false, codecs: [] }),
  };

  console.log(JSON.stringify({ apply, trunkId, before, target }, null, 2));

  if (!apply) {
    console.log("\nDry run — pass --apply to open allowlist + codecs like cloud trunk.");
    return;
  }

  // Self-hosted LiveKit rejects empty ListUpdate for allowedAddresses — rebuild trunk instead.
  const numbers = trunk.numbers || [];
  const dispatchRules = await client.listSipDispatchRule();
  const attachedRules = dispatchRules.filter((r) => (r.trunkIds || []).includes(trunkId));

  await client.deleteSipTrunk(trunkId);

  const recreated = await client.createSipInboundTrunk(
    trunk.name || cfg.inboundTrunkName,
    numbers,
    {
      metadata: trunk.metadata || JSON.stringify({ owner: "transovo", kind: "shared_telnyx_inbound" }),
      media: target.media,
    },
  );

  const newTrunkId = recreated.sipTrunkId || "";
  if (!newTrunkId) throw new Error("Recreated trunk missing id");

  for (const rule of attachedRules) {
    if (!rule.sipDispatchRuleId) continue;
    await client.updateSipDispatchRuleFields(rule.sipDispatchRuleId, {
      trunkIds: new ListUpdate({ set: [newTrunkId] }),
    });
  }

  console.log(
    "\nRebuilt trunk:",
    JSON.stringify(
      {
        oldTrunkId: trunkId,
        newTrunkId,
        allowed: (recreated as { allowedAddresses?: string[] }).allowedAddresses || [],
        media: (recreated as { media?: SIPMediaConfig }).media,
        dispatchRulesUpdated: attachedRules.map((r) => r.sipDispatchRuleId),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
