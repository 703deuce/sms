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
  TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
  TRANSOVO_LIVEKIT_ROOM_PREFIX,
} from "../config";
import type { ExplicitDispatchMetadata } from "../dispatch-metadata";
import { PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY } from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";
import { liveKitDidLookupVariants, toLiveKitInboundDid } from "./did";
import { getLiveKitSipClient } from "./client";
import type { MediaBackend } from "@/lib/voice/media-backend/types";
import { getActiveMediaBackend } from "@/lib/voice/media-backend/resolver";
import {
  VOICE_V3_LIVEKIT_AGENT_NAME,
  buildVoiceV3LiveKitJobMetadataJson,
} from "@/lib/voice-v3/livekit-inbound-dispatch";

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

export function resolveLiveKitDispatchAgentNameFromMetadata(
  metadata: ExplicitDispatchMetadata,
): string {
  if (metadata.livekitDispatchAgentName?.trim()) {
    return metadata.livekitDispatchAgentName.trim();
  }
  return TRANSOVO_LIVEKIT_AGENT_NAME;
}

export function buildLiveKitAgentJobMetadata(
  metadata: ExplicitDispatchMetadata,
): LiveKitAgentJobMetadata {
  const agentName = resolveLiveKitDispatchAgentNameFromMetadata(metadata);
  if (agentName === VOICE_V3_LIVEKIT_AGENT_NAME) {
    throw new Error(
      "buildLiveKitAgentJobMetadata is for legacy runtime snapshots — use buildLiveKitAgentJobMetadataJson for Voice V3",
    );
  }
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

export function buildLiveKitAgentJobMetadataJson(metadata: ExplicitDispatchMetadata): string {
  const agentName = resolveLiveKitDispatchAgentNameFromMetadata(metadata);
  if (agentName === VOICE_V3_LIVEKIT_AGENT_NAME) {
    return buildVoiceV3LiveKitJobMetadataJson({
      workspaceId: metadata.workspaceId!,
      agentId: metadata.agentId!,
      publishedVersionId: metadata.publishedVersionId,
      toE164: metadata.toE164,
      dispatchSource: metadata.dispatchSource || "livekit_job_metadata",
    });
  }
  return JSON.stringify(buildLiveKitAgentJobMetadata(metadata));
}

function assertDispatchAgentMetadataValid(agentName: string, agentMeta: string): void {
  if (agentName === VOICE_V3_LIVEKIT_AGENT_NAME) {
    if (!agentMeta.includes('"runtime":"voice_v3_gpt_live"')) {
      throw new Error("LiveKit Voice V3 dispatch metadata missing voice_v3_gpt_live runtime marker");
    }
    return;
  }
  if (!agentMeta.includes(PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY)) {
    throw new Error(
      `LiveKit dispatch agent metadata missing ${PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY}`,
    );
  }
}

function buildDispatchRuleInfo(input: {
  e164: string;
  trunkId: string;
  dispatchMetadata: ExplicitDispatchMetadata;
  existingRuleId?: string;
}): SIPDispatchRuleInfo {
  const agentName = resolveLiveKitDispatchAgentNameFromMetadata(input.dispatchMetadata);
  const jobMetadataJson = buildLiveKitAgentJobMetadataJson(input.dispatchMetadata);
  const ruleName = dispatchRuleNameForDid(input.e164);
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
      agentId: input.dispatchMetadata.agentId,
      publishedVersionId: input.dispatchMetadata.publishedVersionId || null,
      livekitAgent: agentName,
    }),
    roomConfig: new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName,
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
 * When a shared trunk dispatch rule already owns the DID, LiveKit rejects a second
 * per-DID rule with the same trunk+number. Stamp the runtime snapshot on the shared rule instead.
 */
export async function syncSharedDispatchRuleSnapshot(input: {
  trunkId: string;
  dispatchMetadata: ExplicitDispatchMetadata;
  backend?: MediaBackend;
}): Promise<{ ruleId: string; actions: string[] }> {
  const backend = input.backend ?? getActiveMediaBackend();
  const client = getLiveKitSipClient(backend);
  const agentName = resolveLiveKitDispatchAgentNameFromMetadata(input.dispatchMetadata);
  const jobMetadataJson = buildLiveKitAgentJobMetadataJson(input.dispatchMetadata);

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
    hidePhoneNumber: shared.hidePhoneNumber,
    name: shared.name || TRANSOVO_LIVEKIT_DISPATCH_RULE_NAME,
    metadata: JSON.stringify({
      owner: "transovo",
      kind: "shared_inbound_dispatch_with_snapshot",
      agentId: input.dispatchMetadata.agentId,
      publishedVersionId: input.dispatchMetadata.publishedVersionId || null,
      livekitAgent: agentName,
    }),
    roomConfig: new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName,
          metadata: jobMetadataJson,
        }),
      ],
    }),
  });

  const updated = await client.updateSipDispatchRule(shared.sipDispatchRuleId, dispatchRule);

  const agentMeta = updated.roomConfig?.agents?.[0]?.metadata || "";
  assertDispatchAgentMetadataValid(agentName, agentMeta);

  return {
    ruleId: shared.sipDispatchRuleId,
    actions: ["livekit_updated_shared_dispatch_snapshot"],
  };
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
  const agentName = resolveLiveKitDispatchAgentNameFromMetadata(input.dispatchMetadata);
  const existing = await findDidDispatchRuleByName(input.e164, backend);
  const ruleInfo = buildDispatchRuleInfo({
    e164: input.e164,
    trunkId: input.trunkId,
    dispatchMetadata: input.dispatchMetadata,
    existingRuleId: existing?.sipDispatchRuleId || undefined,
  });

  const actions: string[] = [];
  let rule: SdkDispatchRuleInfo;
  try {
    rule = await upsertDispatchRuleInfo(existing?.sipDispatchRuleId, ruleInfo, backend);
    actions.push(
      existing?.sipDispatchRuleId
        ? "livekit_updated_did_dispatch_snapshot"
        : "livekit_created_did_dispatch_snapshot",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists in dispatch rule/i.test(msg)) {
      throw err;
    }
    const shared = await syncSharedDispatchRuleSnapshot({
      trunkId: input.trunkId,
      dispatchMetadata: input.dispatchMetadata,
      backend,
    });
    actions.push(...shared.actions);
    return { ruleId: shared.ruleId, created: false, actions };
  }

  const ruleId = rule.sipDispatchRuleId || "";
  if (!ruleId) {
    throw new Error(`LiveKit did dispatch rule id missing after sync for ${input.e164}`);
  }

  const agentMeta = rule.roomConfig?.agents?.[0]?.metadata || "";
  assertDispatchAgentMetadataValid(agentName, agentMeta);

  return { ruleId, created: !existing?.sipDispatchRuleId, actions };
}

export function isTransovoDidDispatchRuleName(name: string | undefined | null): boolean {
  return Boolean(name?.startsWith(TRANSOVO_DID_DISPATCH_RULE_PREFIX));
}
