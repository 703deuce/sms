import "server-only";
import {
  RoomAgentDispatch,
  RoomConfiguration,
  SIPDispatchRule,
  SIPDispatchRuleCallee,
  SIPDispatchRuleInfo,
} from "@livekit/protocol";
import { getLiveKitSipClient, TRANSOVO_LIVEKIT_ROOM_PREFIX, VOICE_V3_LIVEKIT_AGENT_NAME } from "./client";

const DISPATCH_PREFIX = "transovo-did-dispatch-";

function dispatchRuleNameForDid(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return `${DISPATCH_PREFIX}${digits || "unknown"}`;
}

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

export async function syncReceptionistDidDispatchRule(input: {
  e164: string;
  trunkId: string;
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
}): Promise<{ ruleId: string; actions: string[] }> {
  const client = getLiveKitSipClient();
  const name = dispatchRuleNameForDid(input.e164);
  const rules = await client.listSipDispatchRule();
  const existing = rules.find((r) => r.name === name);
  const jobMetadataJson = buildJobMetadata(input);
  const roomPrefix = TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call";

  const ruleInfo = new SIPDispatchRuleInfo({
    sipDispatchRuleId: existing?.sipDispatchRuleId || "",
    rule: new SIPDispatchRule({
      rule: {
        case: "dispatchRuleCallee",
        value: new SIPDispatchRuleCallee({ roomPrefix, randomize: true }),
      },
    }),
    trunkIds: [input.trunkId],
    numbers: [input.e164],
    hidePhoneNumber: false,
    name,
    metadata: JSON.stringify({
      owner: "transovo",
      kind: "did_dispatch_with_snapshot",
      e164: input.e164,
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

  const actions: string[] = [];
  let ruleId = existing?.sipDispatchRuleId || "";
  if (ruleId) {
    await client.updateSipDispatchRule(ruleId, ruleInfo);
    actions.push("livekit_updated_did_dispatch_snapshot");
  } else {
    const created = await client.createSipDispatchRule(
      { type: "callee", roomPrefix, randomize: true },
      {
        name,
        trunkIds: [input.trunkId],
        hidePhoneNumber: false,
        metadata: ruleInfo.metadata,
        roomConfig: ruleInfo.roomConfig,
      },
    );
    ruleId = created.sipDispatchRuleId || "";
    actions.push("livekit_created_did_dispatch_snapshot");
  }
  if (!ruleId) throw new Error("LiveKit dispatch rule id missing after sync");
  return { ruleId, actions };
}
