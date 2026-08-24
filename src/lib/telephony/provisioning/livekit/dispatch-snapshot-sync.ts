import {
  RoomAgentDispatch,
  RoomConfiguration,
  SIPDispatchRule,
  SIPDispatchRuleCallee,
  SIPDispatchRuleInfo,
} from "@livekit/protocol";
import type { SIPDispatchRuleInfo as SdkDispatchRuleInfo } from "livekit-server-sdk";
import {
  TRANSOVO_LIVEKIT_AGENT_NAME,
  TRANSOVO_LIVEKIT_ROOM_PREFIX,
} from "../config";
import type { ExplicitDispatchMetadata } from "../dispatch-metadata";
import { PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY } from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";
import { liveKitDidLookupVariants, toLiveKitInboundDid } from "./did";
import { getLiveKitSipClient } from "./client";
import type { MediaBackend } from "@/lib/voice/media-backend/types";
import { getActiveMediaBackend } from "@/lib/voice/media-backend/resolver";

/** Per-DID dispatch rules carry the runtime snapshot in agent job metadata. */
export const TRANSOVO_DID_DISPATCH_RULE_PREFIX = "transovo-did-dispatch-";

const SIP_SVC = "SIP";
const METADATA_SIZE_WARN_BYTES = 450_000;

export type LiveKitAgentJobMetadata = {
  runtime: "transovo-voice-runtime";
  resolve: "embedded_dispatch_snapshot";
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string;
  livekitProfile?: string;
  agentTemplate?: string;
  toE164?: string;
  dispatchSource: "livekit_job_metadata";
  [PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY]?: ExplicitDispatchMetadata["pythonRuntimeBootstrapSnapshot"];
};

export function dispatchRuleNameForDid(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return `${TRANSOVO_DID_DISPATCH_RULE_PREFIX}${digits || "unknown"}`;
}

export function buildLiveKitAgentJobMetadata(
  metadata: ExplicitDispatchMetadata,
): LiveKitAgentJobMetadata {
  const snapshot = metadata.pythonRuntimeBootstrapSnapshot;
  if (!snapshot) {
    throw new Error("Cannot build LiveKit job metadata without pythonRuntimeBootstrapSnapshot");
  }
  return {
    runtime: "transovo-voice-runtime",
    resolve: "embedded_dispatch_snapshot",
    workspaceId: metadata.workspaceId!,
    agentId: metadata.agentId!,
    publishedVersionId: metadata.publishedVersionId,
    livekitProfile: metadata.livekitProfile,
    agentTemplate: metadata.agentTemplate,
    toE164: metadata.toE164,
    dispatchSource: "livekit_job_metadata",
    [PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY]: {
      ...snapshot,
      agentVersionId: metadata.publishedVersionId || snapshot.agentVersionId,
    },
  };
}

function buildDispatchRuleInfo(input: {
  e164: string;
  trunkId: string;
  jobMetadata: LiveKitAgentJobMetadata;
  existingRuleId?: string;
}): SIPDispatchRuleInfo {
  const ruleName = dispatchRuleNameForDid(input.e164);
  const jobMetadataJson = JSON.stringify(input.jobMetadata);
  const metadataBytes = Buffer.byteLength(jobMetadataJson, "utf8");
  if (metadataBytes > METADATA_SIZE_WARN_BYTES) {
    console.warn(
      JSON.stringify({
        service: "transovo-web",
        event: "livekit_dispatch_metadata_large",
        e164: input.e164,
        metadataBytes,
        warnLimitBytes: METADATA_SIZE_WARN_BYTES,
      }),
    );
  }

  const roomPrefix = TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call";
  const dispatchNumbers = [...new Set(liveKitDidLookupVariants(input.e164).map(toLiveKitInboundDid))];

  return new SIPDispatchRuleInfo({
    sipDispatchRuleId: input.existingRuleId || "",
    rule: new SIPDispatchRule({
      rule: {
        case: "dispatchRuleCallee",
        value: new SIPDispatchRuleCallee({
          roomPrefix,
          randomize: true,
        }),
      },
    }),
    trunkIds: [input.trunkId],
    numbers: dispatchNumbers,
    hidePhoneNumber: false,
    name: ruleName,
    metadata: JSON.stringify({
      owner: "transovo",
      kind: "did_dispatch_with_snapshot",
      e164: toLiveKitInboundDid(input.e164),
      agentId: input.jobMetadata.agentId,
      publishedVersionId: input.jobMetadata.publishedVersionId || null,
    }),
    roomConfig: new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: TRANSOVO_LIVEKIT_AGENT_NAME,
          metadata: jobMetadataJson,
        }),
      ],
    }),
  });
}

async function upsertDispatchRuleInfo(
  existingRuleId: string | undefined,
  dispatchRule: SIPDispatchRuleInfo,
  backend: MediaBackend = getActiveMediaBackend(),
): Promise<SdkDispatchRuleInfo> {
  const client = getLiveKitSipClient(backend);
  if (existingRuleId) {
    dispatchRule.sipDispatchRuleId = existingRuleId;
    return client.updateSipDispatchRule(existingRuleId, dispatchRule);
  }

  const roomPrefix =
    dispatchRule.rule?.rule.case === "dispatchRuleCallee"
      ? dispatchRule.rule.rule.value.roomPrefix
      : TRANSOVO_LIVEKIT_ROOM_PREFIX.replace(/-+$/, "") || "transovo-call";
  const randomize =
    dispatchRule.rule?.rule.case === "dispatchRuleCallee"
      ? dispatchRule.rule.rule.value.randomize
      : true;

  const created = await client.createSipDispatchRule(
    {
      type: "callee",
      roomPrefix,
      randomize,
    },
    {
      name: dispatchRule.name,
      trunkIds: dispatchRule.trunkIds,
      hidePhoneNumber: dispatchRule.hidePhoneNumber,
      metadata: dispatchRule.metadata,
      roomConfig: dispatchRule.roomConfig,
    },
  );
  const createdId = created.sipDispatchRuleId || "";
  if (!createdId) {
    throw new Error("LiveKit dispatch rule id missing after create");
  }
  dispatchRule.sipDispatchRuleId = createdId;
  return client.updateSipDispatchRule(createdId, dispatchRule);
}

export async function findDidDispatchRuleByName(
  e164: string,
  backend: MediaBackend = getActiveMediaBackend(),
): Promise<SdkDispatchRuleInfo | null> {
  const client = getLiveKitSipClient(backend);
  const name = dispatchRuleNameForDid(e164);
  const rules = await client.listSipDispatchRule();
  return rules.find((rule) => rule.name === name) || null;
}

/**
 * Stamp immutable runtime snapshot into LiveKit per-DID dispatch rule agent metadata.
 * Enables zero-HTTP bootstrap (`bootstrapPath: dispatch_local`) at call time.
 */
export async function syncDidDispatchRuleSnapshot(input: {
  e164: string;
  trunkId: string;
  dispatchMetadata: ExplicitDispatchMetadata;
  backend?: MediaBackend;
}): Promise<{ ruleId: string; created: boolean; actions: string[] }> {
  const backend = input.backend ?? getActiveMediaBackend();
  const jobMetadata = buildLiveKitAgentJobMetadata(input.dispatchMetadata);
  const existing = await findDidDispatchRuleByName(input.e164, backend);
  const ruleInfo = buildDispatchRuleInfo({
    e164: input.e164,
    trunkId: input.trunkId,
    jobMetadata,
    existingRuleId: existing?.sipDispatchRuleId || undefined,
  });

  const actions: string[] = [];
  const rule = await upsertDispatchRuleInfo(existing?.sipDispatchRuleId, ruleInfo, backend);
  actions.push(
    existing?.sipDispatchRuleId
      ? "livekit_updated_did_dispatch_snapshot"
      : "livekit_created_did_dispatch_snapshot",
  );

  const ruleId = rule.sipDispatchRuleId || "";
  if (!ruleId) {
    throw new Error(`LiveKit did dispatch rule id missing after sync for ${input.e164}`);
  }

  const agentMeta = rule.roomConfig?.agents?.[0]?.metadata || "";
  if (!agentMeta.includes(PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY)) {
    throw new Error(
      `LiveKit did dispatch rule ${ruleId} missing ${PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY} in agent metadata`,
    );
  }

  return { ruleId, created: !existing?.sipDispatchRuleId, actions };
}

export function isTransovoDidDispatchRuleName(name: string | undefined | null): boolean {
  return Boolean(name?.startsWith(TRANSOVO_DID_DISPATCH_RULE_PREFIX));
}
