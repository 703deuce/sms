import "server-only";
import { ListUpdate } from "@livekit/protocol";
import {
  RoomAgentDispatch,
  RoomConfiguration,
  SIPDispatchRule,
  SIPDispatchRuleCallee,
  SIPDispatchRuleInfo,
} from "@livekit/protocol";
import type { SIPDispatchRuleInfo as SdkDispatchRuleInfo } from "livekit-server-sdk";
import { getLiveKitSipClient, TRANSOVO_LIVEKIT_ROOM_PREFIX, VOICE_V3_LIVEKIT_AGENT_NAME } from "./client";
import { TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME } from "@/lib/server/telephony/config";
import {
  dispatchRuleNameForDid,
  dispatchRuleNeedsDeleteRescope,
  e164VariantsForDispatch,
  findPerDidDispatchRule,
  isDuplicateDispatchRuleError,
  numbersWithoutE164,
  parseConflictingDispatchRuleId,
  ruleDispatchCoversDid,
} from "./dispatch-sync-helpers";

export {
  dispatchRuleNameForDid,
  findPerDidDispatchRule,
  isDuplicateDispatchRuleError,
  ruleDispatchCoversDid,
} from "./dispatch-sync-helpers";

function buildJobMetadata(input: {
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
  toE164?: string | null;
}): string {
  return JSON.stringify({
    runtime: "voice_v3_gpt_live",
    resolve: "http_backend_on_sip",
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId || undefined,
    toE164: input.toE164 || undefined,
    dispatchSource: "phone_provision",
  });
}

function buildPerDidDispatchRuleInfo(input: {
  e164: string;
  trunkId: string;
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
  existingRuleId?: string;
}): SIPDispatchRuleInfo {
  const jobMetadataJson = buildJobMetadata({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId,
    toE164: input.e164,
  });
  const roomPrefix = TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call";
  const dispatchNumbers = e164VariantsForDispatch(input.e164);

  return new SIPDispatchRuleInfo({
    sipDispatchRuleId: input.existingRuleId || "",
    rule: new SIPDispatchRule({
      rule: {
        case: "dispatchRuleCallee",
        value: new SIPDispatchRuleCallee({ roomPrefix, randomize: true }),
      },
    }),
    trunkIds: [input.trunkId],
    numbers: dispatchNumbers,
    hidePhoneNumber: false,
    name: dispatchRuleNameForDid(input.e164),
    metadata: JSON.stringify({
      owner: "transovo",
      kind: "did_dispatch_with_snapshot",
      e164: dispatchNumbers[0],
      agentId: input.agentId,
      publishedVersionId: input.publishedVersionId || null,
      livekitAgent: VOICE_V3_LIVEKIT_AGENT_NAME,
    }),
    roomConfig: new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: VOICE_V3_LIVEKIT_AGENT_NAME,
          metadata: jobMetadataJson,
        }),
      ],
    }),
  });
}

function createPayloadFromTemplate(template: SdkDispatchRuleInfo) {
  const roomPrefix = TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call";
  const kind = template.rule?.rule?.case;
  if (kind === "dispatchRuleIndividual") {
    const value = template.rule?.rule?.value;
    return {
      type: "individual" as const,
      roomPrefix: value?.roomPrefix || `${roomPrefix}-`,
      pin: value?.pin ?? "",
    };
  }
  if (kind === "dispatchRuleCallee") {
    const value = template.rule?.rule?.value;
    return {
      type: "callee" as const,
      roomPrefix: value?.roomPrefix || roomPrefix,
      randomize: value?.randomize ?? true,
    };
  }
  return { type: "callee" as const, roomPrefix, randomize: true };
}

/**
 * LiveKit Cloud keeps trunk-wide `dispatchRuleIndividual` rules owning DIDs even when
 * `numbers` is patched. Delete + recreate scoped to remaining DIDs (agent config unchanged).
 */
async function recreateDispatchRuleScoped(input: {
  template: SdkDispatchRuleInfo;
  trunkId: string;
  numbers: string[];
}): Promise<string> {
  const client = getLiveKitSipClient();
  const createPayload = createPayloadFromTemplate(input.template);
  const created = await client.createSipDispatchRule(createPayload, {
    name: input.template.name,
    trunkIds: [input.trunkId],
    hidePhoneNumber: input.template.hidePhoneNumber,
    metadata: input.template.metadata,
    roomConfig: input.template.roomConfig,
  });
  const ruleId = created.sipDispatchRuleId || "";
  if (!ruleId) throw new Error("LiveKit dispatch rule id missing after scoped recreate");

  const info = new SIPDispatchRuleInfo({
    sipDispatchRuleId: ruleId,
    rule: input.template.rule,
    trunkIds: [input.trunkId],
    numbers: input.numbers,
    hidePhoneNumber: input.template.hidePhoneNumber,
    name: input.template.name,
    metadata: input.template.metadata,
    roomConfig: input.template.roomConfig,
  });
  await client.updateSipDispatchRule(ruleId, info);
  return ruleId;
}

async function detachDidFromDispatchRule(input: {
  rule: SdkDispatchRuleInfo;
  e164: string;
  trunkId: string;
}): Promise<string[]> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const ruleId = input.rule.sipDispatchRuleId;
  if (!ruleId) return actions;

  const listed = await client.listSipDispatchRule({ dispatchRuleIds: [ruleId] });
  const full = listed[0] || input.rule;

  const trunkListed = await client.listSipInboundTrunk({ trunkIds: [input.trunkId] });
  const trunkNums = trunkListed[0]?.numbers || [];
  const scopedNums = full.numbers?.length ? full.numbers : trunkNums;
  const remaining = numbersWithoutE164(scopedNums, input.e164);

  if (dispatchRuleNeedsDeleteRescope(full, TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME)) {
    await client.deleteSipDispatchRule(ruleId);
    actions.push(`livekit_deleted_dispatch_${full.name || ruleId}`);
    if (remaining.length > 0) {
      await recreateDispatchRuleScoped({
        template: full,
        trunkId: input.trunkId,
        numbers: remaining,
      });
      actions.push(`livekit_recreated_dispatch_scoped_${full.name || ruleId}`);
    }
    return actions;
  }

  const nextNumbers = numbersWithoutE164(full.numbers || [], input.e164);
  if (nextNumbers.length === (full.numbers || []).length) return actions;

  await client.updateSipDispatchRuleFields(ruleId, {
    numbers: new ListUpdate({ set: nextNumbers }),
  });
  actions.push(`livekit_removed_did_from_dispatch_${full.name || ruleId}`);
  return actions;
}

async function releaseDidFromConflictingDispatchRules(input: {
  e164: string;
  trunkId: string;
  exceptRuleId?: string;
  /** When LiveKit returns the blocking rule id, target it explicitly. */
  forceRuleId?: string;
}): Promise<string[]> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const perDidName = dispatchRuleNameForDid(input.e164);
  const rules = await client.listSipDispatchRule();

  if (input.forceRuleId) {
    const forced = rules.find((r) => r.sipDispatchRuleId === input.forceRuleId);
    if (forced && forced.sipDispatchRuleId !== input.exceptRuleId) {
      actions.push(
        ...(await detachDidFromDispatchRule({
          rule: forced,
          e164: input.e164,
          trunkId: input.trunkId,
        })),
      );
    }
  }

  for (const rule of rules) {
    const ruleId = rule.sipDispatchRuleId;
    if (!ruleId || ruleId === input.exceptRuleId) continue;
    if (rule.name === perDidName) continue;
    if (input.forceRuleId && ruleId === input.forceRuleId) continue;
    if (!ruleDispatchCoversDid(rule, input.e164, input.trunkId)) continue;

    actions.push(
      ...(await detachDidFromDispatchRule({
        rule,
        e164: input.e164,
        trunkId: input.trunkId,
      })),
    );
  }

  return actions;
}

export async function syncReceptionistDidDispatchRule(input: {
  e164: string;
  trunkId: string;
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
}): Promise<{ ruleId: string; actions: string[] }> {
  const client = getLiveKitSipClient();
  const rules = await client.listSipDispatchRule();
  const existingPerDid = findPerDidDispatchRule(rules, input.e164);
  const roomPrefix = TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call";

  const actions: string[] = [];
  actions.push(
    ...(await releaseDidFromConflictingDispatchRules({
      e164: input.e164,
      trunkId: input.trunkId,
      exceptRuleId: existingPerDid?.sipDispatchRuleId,
    })),
  );

  const ruleInfo = buildPerDidDispatchRuleInfo({
    ...input,
    existingRuleId: existingPerDid?.sipDispatchRuleId,
  });

  let ruleId = existingPerDid?.sipDispatchRuleId || "";

  if (ruleId) {
    await client.updateSipDispatchRule(ruleId, ruleInfo);
    actions.push("livekit_updated_did_dispatch_snapshot");
  } else {
    const createOnce = async () => {
      const created = await client.createSipDispatchRule(
        { type: "callee", roomPrefix, randomize: true },
        {
          name: ruleInfo.name,
          trunkIds: ruleInfo.trunkIds,
          hidePhoneNumber: ruleInfo.hidePhoneNumber,
          metadata: ruleInfo.metadata,
          roomConfig: ruleInfo.roomConfig,
        },
      );
      ruleId = created.sipDispatchRuleId || "";
      if (!ruleId) throw new Error("LiveKit dispatch rule id missing after create");
      await client.updateSipDispatchRule(ruleId, ruleInfo);
      actions.push("livekit_created_did_dispatch_snapshot");
    };

    try {
      await createOnce();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!isDuplicateDispatchRuleError(msg)) throw err;
      const forceRuleId = parseConflictingDispatchRuleId(msg);
      actions.push("livekit_retry_after_detach_did");
      actions.push(
        ...(await releaseDidFromConflictingDispatchRules({
          e164: input.e164,
          trunkId: input.trunkId,
          forceRuleId: forceRuleId || undefined,
        })),
      );
      await createOnce();
    }
  }

  if (!ruleId) throw new Error("LiveKit dispatch rule id missing after sync");
  return { ruleId, actions };
}
