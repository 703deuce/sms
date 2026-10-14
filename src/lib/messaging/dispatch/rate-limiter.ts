import "server-only";

import { parseWorkspaceLimits } from "@/lib/settings/limits";

export type DispatchRateLimits = {
  platformPerSecond: number;
  tenantPerSecond: number;
  campaignPerSecond: number;
  senderPerSecond: number;
};

type Bucket = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, Bucket>();

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function getDispatchRateLimits(workspaceLimits?: {
  limits?: unknown;
}): DispatchRateLimits {
  const parsed = parseWorkspaceLimits(workspaceLimits ?? null);
  const tenantOverride = Number(parsed.apiRate);
  return {
    platformPerSecond: envNumber("DISPATCH_PLATFORM_MPS", 50),
    tenantPerSecond:
      Number.isFinite(tenantOverride) && tenantOverride > 0
        ? tenantOverride
        : envNumber("DISPATCH_TENANT_MPS", 10),
    campaignPerSecond: envNumber("DISPATCH_CAMPAIGN_MPS", 5),
    senderPerSecond: envNumber("DISPATCH_SENDER_MPS", 1),
  };
}

function bucketKey(parts: string[]): string {
  return parts.join(":");
}

function takeToken(key: string, perSecond: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: perSecond, lastRefillMs: now };
  const elapsed = (now - bucket.lastRefillMs) / 1000;
  if (elapsed > 0) {
    bucket.tokens = Math.min(perSecond, bucket.tokens + elapsed * perSecond);
    bucket.lastRefillMs = now;
  }
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

export type RateLimitCheckInput = {
  workspaceId: string;
  campaignId?: string;
  senderKey?: string;
  workspaceLimits?: { limits?: unknown };
};

export function canDispatchNow(input: RateLimitCheckInput): {
  allowed: boolean;
  reason?: string;
} {
  const limits = getDispatchRateLimits(input.workspaceLimits);

  // Combined platform-sender MPS is enforced in platform-dispatch at sendQuickSms (distributed).
  if (!takeToken(bucketKey(["tenant", input.workspaceId]), limits.tenantPerSecond)) {
    return { allowed: false, reason: "tenant_rate_limited" };
  }
  if (input.campaignId) {
    if (!takeToken(bucketKey(["campaign", input.campaignId]), limits.campaignPerSecond)) {
      return { allowed: false, reason: "campaign_rate_limited" };
    }
  }
  if (input.senderKey) {
    if (!takeToken(bucketKey(["sender", input.senderKey]), limits.senderPerSecond)) {
      return { allowed: false, reason: "sender_rate_limited" };
    }
  }
  return { allowed: true };
}

/** Test helper — reset in-memory buckets. */
export function resetDispatchRateLimiterForTests() {
  buckets.clear();
}
