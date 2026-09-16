import "server-only";

import type { SendBookingLinkResult } from "./send-booking-link";
import { getVoiceV2SharedRedis } from "./session/redis-client";
import { VOICE_V2_CALL_CONTEXT_TTL_SEC } from "./session/types";

const memoryCache = new Map<string, SendBookingLinkResult>();

function cacheKey(canonicalSessionKey: string, toolInvocationId: string): string {
  return `voice:v2:send-link-idem:${canonicalSessionKey}:${toolInvocationId}`;
}

export async function getSendBookingLinkIdempotentResult(
  canonicalSessionKey: string,
  toolInvocationId: string,
): Promise<SendBookingLinkResult | null> {
  const inv = toolInvocationId.trim();
  if (!inv) return null;
  const key = cacheKey(canonicalSessionKey, inv);
  const mem = memoryCache.get(key);
  if (mem) return mem;

  const r = await getVoiceV2SharedRedis();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as SendBookingLinkResult;
  } catch {
    return null;
  }
}

export async function storeSendBookingLinkIdempotentResult(
  canonicalSessionKey: string,
  toolInvocationId: string,
  result: SendBookingLinkResult,
): Promise<void> {
  const inv = toolInvocationId.trim();
  if (!inv) return;
  const key = cacheKey(canonicalSessionKey, inv);
  memoryCache.set(key, result);
  const r = await getVoiceV2SharedRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(result), "EX", VOICE_V2_CALL_CONTEXT_TTL_SEC);
  } catch {
    // non-blocking
  }
}

export function clearSendBookingLinkIdempotencyForTests(): void {
  memoryCache.clear();
}
