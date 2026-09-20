/**
 * Repair LiveKit SIP 404 / Telnyx UNALLOCATED_NUMBER for +15717491060.
 * Recreates certified wildcard Telnyx IP trunk + global individual dispatch (866 pattern).
 * Sets dispatch agent to transovo-voice-v3 for Phase 54 cutover.
 *
 *   MEDIA_BACKEND_MODE=livekit_cloud PHONE_E164=+15717491060 \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/repair-571-livekit-sip-404-wildcard.ts
 */
import {
  RoomAgentDispatch,
  RoomConfiguration,
  SIPDispatchRule,
  SIPDispatchRuleIndividual,
  SIPDispatchRuleInfo,
} from "@livekit/protocol";
import { fullResetLiveKitSipIngress } from "../src/lib/telephony/provisioning/livekit/full-reset";
import { getLiveKitSipClient } from "../src/lib/telephony/provisioning/livekit/client";
import { pruneStaleTelnyxFqdns } from "../src/lib/telephony/provisioning/telnyx/sip-connection";

const E164 = (process.env.PHONE_E164 || "+15717491060").trim();
const V3_AGENT =
  process.env.VOICE_V3_LIVEKIT_AGENT_NAME?.trim() || "transovo-voice-v3";

async function main() {
  process.env.MEDIA_BACKEND_MODE = "livekit_cloud";

  const pruned = await pruneStaleTelnyxFqdns();
  console.log("TELNYX_FQDN_PRUNE", pruned);

  const reset = await fullResetLiveKitSipIngress(E164);
  console.log("LIVEKIT_FULL_RESET", reset);

  const client = getLiveKitSipClient();
  const rules = await client.listSipDispatchRule();
  const rule = rules.find((r) => r.sipDispatchRuleId === reset.dispatchRuleId) || rules[0];
  const ruleId = rule?.sipDispatchRuleId;
  if (!ruleId) throw new Error("dispatch rule missing after reset");

  const updated = await client.updateSipDispatchRule(
    ruleId,
    new SIPDispatchRuleInfo({
      sipDispatchRuleId: ruleId,
      rule: new SIPDispatchRule({
        rule: {
          case: "dispatchRuleIndividual",
          value: new SIPDispatchRuleIndividual({
            roomPrefix: "transovo-call-",
            pin: "",
            noRandomness: false,
          }),
        },
      }),
      trunkIds: rule.trunkIds || [],
      hidePhoneNumber: rule.hidePhoneNumber,
      name: rule.name,
      metadata: rule.metadata,
      roomConfig: new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: V3_AGENT,
            metadata: JSON.stringify({
              runtime: "voice_v3_gpt_live",
              toE164: E164,
              dispatchSource: "repair_571_wildcard",
            }),
          }),
        ],
      }),
    }),
  );

  const trunks = await client.listSipInboundTrunk();
  console.log("LIVEKIT_AFTER", {
    trunks: trunks.map((t) => ({
      id: t.sipTrunkId,
      numbers: t.numbers,
      allowed: (t as { allowedAddresses?: string[] }).allowedAddresses,
    })),
    dispatch: {
      id: updated.sipDispatchRuleId,
      agent: updated.roomConfig?.agents?.[0]?.agentName,
      trunkIds: updated.trunkIds,
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
