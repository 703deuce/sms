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
      let rule = listed[0];
      const current = rule.trunkIds || [];
      if (!current.includes(input.trunkId) || current.some((id) => id !== input.trunkId)) {
        rule = await client.updateSipDispatchRuleFields(rule.sipDispatchRuleId!, {
          trunkIds: new ListUpdate({ set: [input.trunkId] }),
        });
        actions.push("replaced_stale_dispatch_trunk_ids");
      }
      return { rule, created: false, actions: [...actions, "reuse_env_dispatch_rule_id"] };
    }
    actions.push("env_dispatch_rule_id_stale");
  }

  let rule = await findDispatchRuleByName(TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME);
  if (rule) {
    const current = rule.trunkIds || [];
    const next = current.includes(input.trunkId) ? current : [...current, input.trunkId];
    const staleIds = next.filter((id) => id !== input.trunkId);
    if (staleIds.length > 0 || next.length !== current.length) {
      rule = await client.updateSipDispatchRuleFields(rule.sipDispatchRuleId!, {
        trunkIds: new ListUpdate({ set: [input.trunkId] }),
      });
      actions.push(
        staleIds.length > 0
          ? "replaced_stale_dispatch_trunk_ids"
          : "attached_trunk_to_existing_dispatch_rule",
      );
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
