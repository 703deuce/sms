import "server-only";
import {
  RoomAgentDispatch,
  RoomConfiguration,
  SIPDispatchRule,
  SIPDispatchRuleIndividual,
  SIPDispatchRuleInfo,
} from "@livekit/protocol";
import type { SIPDispatchRuleInfo as SdkDispatchRuleInfo } from "livekit-server-sdk";
import { getLiveKitSipClient, TRANSOVO_LIVEKIT_ROOM_PREFIX, VOICE_V3_LIVEKIT_AGENT_NAME } from "./client";
import { TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME } from "@/lib/server/telephony/config";
import {
  buildCanonicalV3DispatchAgentMetadata,
  isObsoletePerDidDispatchRuleName,
} from "./canonical-dispatch-helpers";

export {
  OBSOLETE_PER_DID_DISPATCH_PREFIX,
  buildCanonicalV3DispatchAgentMetadata,
  isObsoletePerDidDispatchRuleName,
} from "./canonical-dispatch-helpers";

function buildCanonicalDispatchRuleInfo(input: {
  trunkId: string;
  existingRuleId?: string;
}): SIPDispatchRuleInfo {
  const roomPrefix = TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call-";
  const agentMetadata = buildCanonicalV3DispatchAgentMetadata();

  return new SIPDispatchRuleInfo({
    sipDispatchRuleId: input.existingRuleId || "",
    rule: new SIPDispatchRule({
      rule: {
        case: "dispatchRuleIndividual",
        value: new SIPDispatchRuleIndividual({
          roomPrefix: roomPrefix.endsWith("-") ? roomPrefix : `${roomPrefix}-`,
          pin: "",
          noRandomness: false,
        }),
      },
    }),
    trunkIds: [input.trunkId],
    hidePhoneNumber: false,
    name: TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
    metadata: JSON.stringify({
      owner: "transovo",
      kind: "canonical_v3_shared_inbound",
      livekitAgent: VOICE_V3_LIVEKIT_AGENT_NAME,
      tenantResolution: "new_app_called_did",
    }),
    roomConfig: new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: VOICE_V3_LIVEKIT_AGENT_NAME,
          metadata: agentMetadata,
        }),
      ],
    }),
  });
}

/**
 * One trunk-scoped individual dispatch rule → one room per call → `transovo-voice-v3`.
 * Tenant config resolved in `resolveNativeVoiceV3LiveKitSession` from dialed E.164.
 */
export async function ensureCanonicalV3SharedDispatchRule(input: {
  trunkId: string;
}): Promise<{ ruleId: string; created: boolean; actions: string[] }> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const rules = await client.listSipDispatchRule();

  let existing: SdkDispatchRuleInfo | undefined =
    rules.find((r) => r.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME) ||
    rules.find(
      (r) =>
        (r.trunkIds || []).includes(input.trunkId) &&
        r.roomConfig?.agents?.[0]?.agentName === VOICE_V3_LIVEKIT_AGENT_NAME &&
        !isObsoletePerDidDispatchRuleName(r.name),
    );

  const ruleInfo = buildCanonicalDispatchRuleInfo({
    trunkId: input.trunkId,
    existingRuleId: existing?.sipDispatchRuleId,
  });

  if (existing?.sipDispatchRuleId) {
    await client.updateSipDispatchRule(existing.sipDispatchRuleId, ruleInfo);
    actions.push("livekit_updated_canonical_v3_dispatch");
    return { ruleId: existing.sipDispatchRuleId, created: false, actions };
  }

  const roomPrefix = TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call-";
  const created = await client.createSipDispatchRule(
    {
      type: "individual",
      roomPrefix: roomPrefix.endsWith("-") ? roomPrefix : `${roomPrefix}-`,
    },
    {
      name: TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
      trunkIds: [input.trunkId],
      hidePhoneNumber: false,
      metadata: ruleInfo.metadata,
      roomConfig: ruleInfo.roomConfig,
    },
  );
  const ruleId = created.sipDispatchRuleId || "";
  if (!ruleId) throw new Error("LiveKit canonical dispatch rule id missing after create");
  await client.updateSipDispatchRule(ruleId, ruleInfo);
  actions.push("livekit_created_canonical_v3_dispatch");
  return { ruleId, created: true, actions };
}

export type PruneDispatchRulesResult = {
  actions: string[];
  deletedRuleIds: string[];
  keptRuleIds: string[];
};

/**
 * Remove per-DID and other obsolete dispatch rules. Keeps the canonical shared rule.
 */
export async function pruneObsoleteDispatchRules(input?: {
  keepRuleId?: string;
  dryRun?: boolean;
}): Promise<PruneDispatchRulesResult> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const deletedRuleIds: string[] = [];
  const keptRuleIds: string[] = [];
  const dryRun = input?.dryRun ?? false;

  const rules = await client.listSipDispatchRule();
  const canonical =
    rules.find((r) => r.sipDispatchRuleId === input?.keepRuleId) ||
    rules.find((r) => r.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME);

  const keepId = input?.keepRuleId || canonical?.sipDispatchRuleId;

  for (const rule of rules) {
    const ruleId = rule.sipDispatchRuleId;
    if (!ruleId) continue;
    if (keepId && ruleId === keepId) {
      keptRuleIds.push(ruleId);
      continue;
    }
    if (rule.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME && ruleId !== keepId) {
      if (!dryRun) await client.deleteSipDispatchRule(ruleId);
      deletedRuleIds.push(ruleId);
      actions.push(`livekit_deleted_duplicate_shared_dispatch_${ruleId}`);
      continue;
    }
    if (isObsoletePerDidDispatchRuleName(rule.name)) {
      if (!dryRun) await client.deleteSipDispatchRule(ruleId);
      deletedRuleIds.push(ruleId);
      actions.push(`livekit_deleted_obsolete_per_did_dispatch_${rule.name}`);
      continue;
    }
    keptRuleIds.push(ruleId);
  }

  if (dryRun && deletedRuleIds.length) {
    actions.push(`dry_run_would_delete_${deletedRuleIds.length}_rules`);
  }

  return { actions, deletedRuleIds, keptRuleIds };
}
