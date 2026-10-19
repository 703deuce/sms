import "server-only";
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
  e164VariantsForDispatch,
  findDispatchRuleForDid,
  isDuplicateDispatchRuleError,
} from "./dispatch-sync-helpers";

export {
  dispatchRuleNameForDid,
  findDispatchRuleForDid,
  isDuplicateDispatchRuleError,
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

function buildDispatchRuleInfo(input: {
  e164: string;
  trunkId: string;
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
  existing?: SdkDispatchRuleInfo | null;
}): SIPDispatchRuleInfo {
  const jobMetadataJson = buildJobMetadata({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId,
    toE164: input.e164,
  });
  const roomPrefix = TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call";
  const dispatchNumbers = e164VariantsForDispatch(input.e164);
  const preferPerDidName = dispatchRuleNameForDid(input.e164);
  const keepLegacyName =
    input.existing?.name &&
    input.existing.name !== preferPerDidName &&
    input.existing.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME;

  return new SIPDispatchRuleInfo({
    sipDispatchRuleId: input.existing?.sipDispatchRuleId || "",
    rule: new SIPDispatchRule({
      rule: {
        case: "dispatchRuleCallee",
        value: new SIPDispatchRuleCallee({ roomPrefix, randomize: true }),
      },
    }),
    trunkIds: input.existing?.trunkIds?.length
      ? input.existing.trunkIds
      : [input.trunkId],
    numbers: keepLegacyName
      ? input.existing?.numbers || dispatchNumbers
      : dispatchNumbers,
    hidePhoneNumber: input.existing?.hidePhoneNumber ?? false,
    name: keepLegacyName ? input.existing!.name! : preferPerDidName,
    metadata: JSON.stringify({
      owner: "transovo",
      kind: keepLegacyName ? "shared_inbound_dispatch_with_snapshot" : "did_dispatch_with_snapshot",
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
 * Shared trunk rule already owns this DID — LiveKit rejects a second rule with the same trunk+number.
 */
async function syncSharedDispatchRuleSnapshot(input: {
  trunkId: string;
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
  toE164?: string | null;
}): Promise<{ ruleId: string; actions: string[] }> {
  const client = getLiveKitSipClient();
  const jobMetadataJson = buildJobMetadata({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId,
    toE164: input.toE164,
  });

  const rules = await client.listSipDispatchRule();
  const shared =
    rules.find((r) => r.name === TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME) ||
    rules.find((r) => (r.trunkIds || []).includes(input.trunkId)) ||
    null;
  if (!shared?.sipDispatchRuleId) {
    throw new Error("No shared LiveKit dispatch rule found for trunk snapshot sync");
  }

  const dispatchRule = new SIPDispatchRuleInfo({
    sipDispatchRuleId: shared.sipDispatchRuleId,
    rule: shared.rule,
    trunkIds: shared.trunkIds || [input.trunkId],
    numbers: shared.numbers,
    hidePhoneNumber: shared.hidePhoneNumber,
    name: shared.name || TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
    metadata: JSON.stringify({
      owner: "transovo",
      kind: "shared_inbound_dispatch_with_snapshot",
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

  await client.updateSipDispatchRule(shared.sipDispatchRuleId, dispatchRule);
  return {
    ruleId: shared.sipDispatchRuleId,
    actions: ["livekit_updated_shared_dispatch_snapshot"],
  };
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
  const existing = findDispatchRuleForDid(rules, input.e164, input.trunkId);
  const ruleInfo = buildDispatchRuleInfo({ ...input, existing });
  const roomPrefix = TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call";

  const actions: string[] = [];
  let ruleId = existing?.sipDispatchRuleId || "";

  if (ruleId) {
    await client.updateSipDispatchRule(ruleId, ruleInfo);
    actions.push(
      existing?.name === dispatchRuleNameForDid(input.e164)
        ? "livekit_updated_did_dispatch_snapshot"
        : "livekit_updated_existing_dispatch_for_did",
    );
  } else {
    try {
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
      if (ruleId) {
        await client.updateSipDispatchRule(ruleId, ruleInfo);
      }
      actions.push("livekit_created_did_dispatch_snapshot");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!isDuplicateDispatchRuleError(msg)) throw err;
      const shared = await syncSharedDispatchRuleSnapshot({
        trunkId: input.trunkId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        publishedVersionId: input.publishedVersionId,
        toE164: input.e164,
      });
      actions.push(...shared.actions);
      ruleId = shared.ruleId;
    }
  }

  if (!ruleId) throw new Error("LiveKit dispatch rule id missing after sync");
  return { ruleId, actions };
}
