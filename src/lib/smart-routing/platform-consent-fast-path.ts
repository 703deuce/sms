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
