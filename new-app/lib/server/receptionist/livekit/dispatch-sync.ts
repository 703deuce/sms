import "server-only";
import { ListUpdate } from "@livekit/protocol";
import {
  RoomAgentDispatch,
  RoomConfiguration,
  SIPDispatchRule,
  SIPDispatchRuleCallee,
  SIPDispatchRuleInfo,
} from "@livekit/protocol";
import { getLiveKitSipClient, TRANSOVO_LIVEKIT_ROOM_PREFIX, VOICE_V3_LIVEKIT_AGENT_NAME } from "./client";
import {
  dispatchRuleNameForDid,
  e164VariantsForDispatch,
  findPerDidDispatchRule,
  isDuplicateDispatchRuleError,
  numbersWithoutE164,
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

/**
 * LiveKit allows only one dispatch rule per trunk+number. Remove this DID from any other
 * rule (e.g. legacy `transovo-inbound-dispatch`) without changing those rules' agent metadata.
 */
async function releaseDidFromConflictingDispatchRules(input: {
  e164: string;
  trunkId: string;
  exceptRuleId?: string;
}): Promise<string[]> {
  const client = getLiveKitSipClient();
  const actions: string[] = [];
  const perDidName = dispatchRuleNameForDid(input.e164);
  const rules = await client.listSipDispatchRule();

  for (const rule of rules) {
    const ruleId = rule.sipDispatchRuleId;
    if (!ruleId || ruleId === input.exceptRuleId) continue;
    if (rule.name === perDidName) continue;
    if (!ruleDispatchCoversDid(rule, input.e164, input.trunkId)) continue;

    const nums = rule.numbers || [];
    let nextNumbers: string[];

    if (nums.length === 0) {
      const listed = await client.listSipInboundTrunk({ trunkIds: [input.trunkId] });
      const trunkNums = listed[0]?.numbers || [];
      nextNumbers = numbersWithoutE164(trunkNums, input.e164);
      actions.push(`livekit_narrowed_wildcard_dispatch_${rule.name || ruleId}`);
    } else {
      nextNumbers = numbersWithoutE164(nums, input.e164);
      if (nextNumbers.length === nums.length) continue;
      actions.push(`livekit_removed_did_from_dispatch_${rule.name || ruleId}`);
    }

    await client.updateSipDispatchRuleFields(ruleId, {
      numbers: new ListUpdate({ set: nextNumbers }),
    });
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
      actions.push("livekit_retry_after_release_did");
      actions.push(
        ...(await releaseDidFromConflictingDispatchRules({
          e164: input.e164,
          trunkId: input.trunkId,
        })),
      );
      await createOnce();
    }
  }

  if (!ruleId) throw new Error("LiveKit dispatch rule id missing after sync");
  return { ruleId, actions };
}
