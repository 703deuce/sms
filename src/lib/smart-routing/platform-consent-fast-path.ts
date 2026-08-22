import "server-only";

import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { publicPlaybackUrl } from "./media-service";
import type { CompiledFlow, CompiledNode } from "./types";

type CachedConsentFastPath = {
  workspaceId: string;
  flowId: string;
  flowVersionId: string;
  consentNodeId: string;
  consentDigit: string;
  playUrl: string;
  expiresAt: number;
};

let cache: CachedConsentFastPath | null = null;
const TTL_MS = 5 * 60 * 1000;

/** call_control_ids that already received answer+gather in the webhook hot path. */
const earlyForwardGatherStarted = new Set<string>();

export function wasEarly571ForwardGatherStarted(callControlId: string): boolean {
  return earlyForwardGatherStarted.has(callControlId);
}

function markEarly571ForwardGatherStarted(callControlId: string) {
  earlyForwardGatherStarted.add(callControlId);
  setTimeout(() => earlyForwardGatherStarted.delete(callControlId), 120_000);
}

/**
 * Zero-DB Press-1 audio for carrier-forwarded legs — must be available synchronously
 * in the call.initiated webhook before any database writes.
 */
export function getImmediate571ConsentGather():
  | { playUrl: string; consentDigit: string; audioAssetId: string }
  | null {
  const assetId =
    process.env.MCTB_PLATFORM_CONSENT_AUDIO_ASSET_ID?.trim() ||
    cache?.playUrl.split("/").pop()?.trim() ||
    "cmt3o8tyd1o5r0o4k3e4n5v2l";
  const playUrl = publicPlaybackUrl(assetId);
  if (!playUrl.startsWith("http")) return null;
  return { playUrl, consentDigit: "1", audioAssetId: assetId };
}

/**
 * Answer + start Press-1 gather before any DB — AT&T forward legs expire in ~5s total.
 * Returns true when gather was issued.
 */
export async function startImmediate571ForwardGather(input: {
  callControlId: string;
  workspaceId: string;
  flowId: string;
}): Promise<boolean> {
  const cfg = getImmediate571ConsentGather();
  if (!cfg) return false;

  const { answerCall, gatherUsingAudio } = await import("./telnyx-provider");
  await answerCall(input.callControlId).catch((err) => {
    console.error("[smart-routing] immediate forward answer failed", {
      callControlId: input.callControlId,
      err,
    });
  });

  const clientState = {
    kind: "smart_routing" as const,
    sessionId: `pending:${input.callControlId}`,
    workspaceId: input.workspaceId,
    flowId: input.flowId,
    nodeId: "consent",
    awaiting: "sms_consent",
  };

  try {
    await gatherUsingAudio({
      callControlId: input.callControlId,
      audioUrl: cfg.playUrl,
      validDigits: cfg.consentDigit,
      clientState,
    });
    markEarly571ForwardGatherStarted(input.callControlId);
    return true;
  } catch (err) {
    console.error("[smart-routing] immediate forward gather failed", {
      callControlId: input.callControlId,
      err,
    });
    return false;
  }
}

function findSmsConsentNode(compiled: CompiledFlow): CompiledNode | null {
  for (const node of Object.values(compiled.nodes)) {
    if (node.type === "SMS_CONSENT") return node;
  }
  return null;
}

/** Cached Press-1 playback for platform 571 — avoids DB during carrier-forward legs (~5s TTL). */
export async function resolvePlatformConsentFastPath(input: {
  workspaceId: string;
  flowId: string;
  flowVersionId: string;
  calledNumber: string;
  compiled: CompiledFlow;
}): Promise<CachedConsentFastPath | null> {
  if (input.calledNumber !== MCTB_PLATFORM_DEMO_E164) return null;
  if (cache && cache.expiresAt > Date.now() && cache.flowVersionId === input.flowVersionId) {
    return cache;
  }

  const consentNode = findSmsConsentNode(input.compiled);
  if (!consentNode) return null;

  const assetId = String(consentNode.config.audioAssetId ?? "").trim();
  if (!assetId) return null;

  const playUrl = publicPlaybackUrl(assetId);
  if (!playUrl.startsWith("http")) return null;

  cache = {
    workspaceId: input.workspaceId,
    flowId: input.flowId,
    flowVersionId: input.flowVersionId,
    consentNodeId: consentNode.id,
    consentDigit: String(consentNode.config.consentDigit ?? "1"),
    playUrl,
    expiresAt: Date.now() + TTL_MS,
  };
  return cache;
}
