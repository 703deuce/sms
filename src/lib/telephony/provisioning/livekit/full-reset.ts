import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import {
  TRANSOVO_LIVEKIT_AGENT_NAME,
  TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
  TRANSOVO_LIVEKIT_ROOM_PREFIX,
  TRANSOVO_LIVEKIT_TRUNK_NAME,
} from "../config";
import { toLiveKitInboundDid } from "./did";
import { getLiveKitSipClient } from "./client";
import { TELNYX_US_SIGNALING_IPS } from "./telnyx-ips";

/**
 * Delete every inbound trunk and dispatch rule, then recreate minimal Telnyx ingress:
 * - Wildcard inbound trunk (any DID from Telnyx US signaling IPs)
 * - Global individual dispatch rule (no trunkIds filter)
 */
export async function fullResetLiveKitSipIngress(e164: string): Promise<{
  trunkId: string;
  dispatchRuleId: string;
  actions: string[];
}> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];

  for (const trunk of await client.listSipInboundTrunk()) {
    const trunkId = trunk.sipTrunkId || "";
    if (!trunkId) continue;
    await client.deleteSipTrunk(trunkId);
    actions.push(`deleted_trunk_${trunk.name || trunkId}`);
  }

  for (const rule of await client.listSipDispatchRule()) {
    const ruleId = rule.sipDispatchRuleId || "";
    if (!ruleId) continue;
    await client.deleteSipDispatchRule(ruleId);
    actions.push(`deleted_dispatch_${rule.name || ruleId}`);
  }

  const trunkDid = toLiveKitInboundDid(e164);
  const trunk = await client.createSipInboundTrunk(
    TRANSOVO_LIVEKIT_TRUNK_NAME,
    [],
    {
      allowedAddresses: [...TELNYX_US_SIGNALING_IPS],
      metadata: JSON.stringify({
        owner: "transovo",
        kind: "telnyx_wildcard_inbound",
        primaryDid: trunkDid,
      }),
    },
  );
  const trunkId = trunk.sipTrunkId || "";
  if (!trunkId) throw new Error("LiveKit trunk id missing after full reset");
  actions.push("created_wildcard_inbound_trunk");

  const rule = await client.createSipDispatchRule(
    {
      type: "individual",
      roomPrefix: TRANSOVO_LIVEKIT_ROOM_PREFIX,
    },
    {
      name: TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
      hidePhoneNumber: false,
      metadata: JSON.stringify({ owner: "transovo", kind: "global_inbound_dispatch" }),
      roomConfig: new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: TRANSOVO_LIVEKIT_AGENT_NAME,
          }),
        ],
      }),
    },
  );
  const dispatchRuleId = rule.sipDispatchRuleId || "";
  if (!dispatchRuleId) throw new Error("LiveKit dispatch rule id missing after full reset");
  actions.push("created_global_dispatch_rule");

  return { trunkId, dispatchRuleId, actions };
}
