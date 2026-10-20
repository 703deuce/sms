/**
 * Per-provider rate limit management — isolated; one CRM cannot starve another.
 * Token-bucket style with backoff hints persisted on the connection config.
 */

import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import type { CrmProviderId } from "../types";

export type ProviderRateLimitConfig = {
  /** Sustained requests per minute. */
  rpm: number;
  /** Short burst allowance. */
  burst: number;
  /** Minimum spacing between calls (ms). */
  minIntervalMs: number;
};

const DEFAULTS: Record<CrmProviderId, ProviderRateLimitConfig> = {
  salesforce: { rpm: 80, burst: 20, minIntervalMs: 50 },
  zoho: { rpm: 60, burst: 15, minIntervalMs: 80 },
  pipedrive: { rpm: 100, burst: 25, minIntervalMs: 40 },
};

type BucketState = {
  tokens: number;
  updatedAt: number;
  cooldownUntil: number;
  consecutive429: number;
};

const memory = new Map<string, BucketState>();

function key(workspaceId: string, provider: CrmProviderId) {
  return `${workspaceId}:${provider}`;
}

function cfgFor(provider: CrmProviderId): ProviderRateLimitConfig {
  return DEFAULTS[provider];
}

function getBucket(workspaceId: string, provider: CrmProviderId): BucketState {
  const k = key(workspaceId, provider);
  let b = memory.get(k);
  if (!b) {
    const cfg = cfgFor(provider);
    b = { tokens: cfg.burst, updatedAt: Date.now(), cooldownUntil: 0, consecutive429: 0 };
    memory.set(k, b);
  }
  return b;
}

function refill(b: BucketState, provider: CrmProviderId) {
  const cfg = cfgFor(provider);
  const now = Date.now();
  const elapsed = Math.max(0, now - b.updatedAt);
  const ratePerMs = cfg.rpm / 60_000;
  b.tokens = Math.min(cfg.burst, b.tokens + elapsed * ratePerMs);
  b.updatedAt = now;
}

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; retryAfterMs: number; reason: string };

/** Call before each outbound CRM API job. */
export function acquireCrmRateLimit(
  workspaceId: string,
  provider: CrmProviderId,
): RateLimitDecision {
  const cfg = cfgFor(provider);
  const b = getBucket(workspaceId, provider);
  const now = Date.now();
  if (b.cooldownUntil > now) {
    return {
      ok: false,
      retryAfterMs: b.cooldownUntil - now,
      reason: `${provider} cooling down after rate limit`,
    };
  }
  refill(b, provider);
  if (b.tokens < 1) {
    const wait = Math.max(cfg.minIntervalMs, Math.ceil((1 - b.tokens) / (cfg.rpm / 60_000)));
    return { ok: false, retryAfterMs: wait, reason: `${provider} token bucket empty` };
  }
  b.tokens -= 1;
  return { ok: true };
}

/** Signal a 429 from the provider — exponential cooldown, isolated per provider. */
export async function noteCrmRateLimitHit(
  workspaceId: string,
  provider: CrmProviderId,
  retryAfterHeaderSeconds?: number | null,
) {
  const b = getBucket(workspaceId, provider);
  b.consecutive429 += 1;
  const backoff = retryAfterHeaderSeconds
    ? retryAfterHeaderSeconds * 1000
    : Math.min(60_000, 2_000 * 2 ** Math.min(b.consecutive429, 5));
  b.cooldownUntil = Date.now() + backoff;
  b.tokens = 0;

  const conn = await getConnection(workspaceId, provider);
  const cfg = (conn?.configJson || {}) as Record<string, unknown>;
  await upsertConnection({
    workspaceId,
    provider,
    config: {
      rateLimit: {
        ...(typeof cfg.rateLimit === "object" && cfg.rateLimit ? cfg.rateLimit : {}),
        cooldownUntil: new Date(b.cooldownUntil).toISOString(),
        consecutive429: b.consecutive429,
        lastHitAt: new Date().toISOString(),
      },
    },
    mergeConfig: true,
  }).catch(() => undefined);

  return { retryAfterMs: backoff };
}

export async function noteCrmRateLimitSuccess(
  workspaceId: string,
  provider: CrmProviderId,
) {
  const b = getBucket(workspaceId, provider);
  b.consecutive429 = 0;
  // Soft clear persisted cooldown when healthy again
  if (b.cooldownUntil && b.cooldownUntil <= Date.now()) {
    await upsertConnection({
      workspaceId,
      provider,
      config: {
        rateLimit: {
          cooldownUntil: null,
          consecutive429: 0,
          recoveredAt: new Date().toISOString(),
        },
      },
      mergeConfig: true,
    }).catch(() => undefined);
  }
}

export function getCrmRateLimitSnapshot(workspaceId: string, provider: CrmProviderId) {
  const cfg = cfgFor(provider);
  const b = getBucket(workspaceId, provider);
  refill(b, provider);
  return {
    provider,
    rpm: cfg.rpm,
    burst: cfg.burst,
    tokens: Math.round(b.tokens * 100) / 100,
    cooldownUntil: b.cooldownUntil || null,
    consecutive429: b.consecutive429,
    status: b.cooldownUntil > Date.now() ? ("throttled" as const) : ("ok" as const),
  };
}
