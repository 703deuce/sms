import { ListUpdate, RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import type { SIPDispatchRuleInfo } from "livekit-server-sdk";
import {
  getStoredLiveKitDispatchRuleId,
  TRANSOVO_LIVEKIT_AGENT_NAME,
  TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
  TRANSOVO_LIVEKIT_ROOM_PREFIX,
} from "../config";
import { getLiveKitSipClient } from "./client";

export async function findDispatchRuleByName(
  name: string,
): Promise<SIPDispatchRuleInfo | null> {
  const client = getLiveKitSipClient();
  const rules = await client.listSipDispatchRule();
  return rules.find((r) => r.name === name) || null;
}

export async function ensureSharedDispatchRule(input: {
  trunkId: string;
}): Promise<{ rule: SIPDispatchRuleInfo; created: boolean; actions: string[] }> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];

  const storedId = getStoredLiveKitDispatchRuleId();
  if (storedId) {
    const listed = await client.listSipDispatchRule({ dispatchRuleIds: [storedId] });
    if (listed[0]) {
      return { rule: listed[0], created: false, actions: ["reuse_env_dispatch_rule_id"] };
    }
    actions.push("env_dispatch_rule_id_stale");
  }

  let rule = await findDispatchRuleByName(TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME);
  if (rule) {
    const trunkIds = new Set(rule.trunkIds || []);
    if (!trunkIds.has(input.trunkId)) {
      trunkIds.add(input.trunkId);
      rule = await client.updateSipDispatchRuleFields(rule.sipDispatchRuleId!, {
        trunkIds: new ListUpdate({ set: [...trunkIds] }),
      });
      actions.push("attached_trunk_to_existing_dispatch_rule");
    }
    return { rule, created: false, actions: [...actions, "reuse_named_dispatch_rule"] };
  }

  rule = await client.createSipDispatchRule(
    {
      type: "individual",
      roomPrefix: TRANSOVO_LIVEKIT_ROOM_PREFIX,
    },
    {
      name: TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
      trunkIds: [input.trunkId],
      hidePhoneNumber: false,
      metadata: JSON.stringify({ owner: "transovo", kind: "shared_inbound_dispatch" }),
      roomConfig: new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: TRANSOVO_LIVEKIT_AGENT_NAME,
          }),
        ],
      }),
    },
  );
  actions.push("created_dispatch_rule");
  return { rule, created: true, actions };
}
