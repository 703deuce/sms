/** Simple per-process sliding-window rate limiter with optional Redis INCR. */

import type Redis from "ioredis";
import { getRedisUrl } from "@/lib/queue/config";

const buckets = new Map<string, number[]>();

let redisClient: Redis | null = null;
let redisInitFailed = false;

function getRedisClient(): Redis | null {
  const url = getRedisUrl();
  if (!url || redisInitFailed) return null;
  if (redisClient) return redisClient;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis") as typeof import("ioredis").default;
    redisClient = new IORedis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      ...(url.startsWith("rediss://") ? { tls: { rejectUnauthorized: true } } : {}),
    });
    redisClient.on("error", () => {
      /* fallback to memory on next call */
    });
    return redisClient;
  } catch {
    redisInitFailed = true;
    return null;
  }
}

function assertRateLimitMemory(params: {
  key: string;
  maxPerWindow?: number;
  windowMs?: number;
}): { ok: true } | { ok: false; retryAfterMs: number } {
  const max = params.maxPerWindow ?? 10;
  const windowMs = params.windowMs ?? 60_000;
  const now = Date.now();
  const prev = (buckets.get(params.key) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= max) {
    const retryAfterMs = Math.max(50, windowMs - (now - (prev[0] ?? now)));
    buckets.set(params.key, prev);
    return { ok: false, retryAfterMs };
  }
  prev.push(now);
  buckets.set(params.key, prev);
  if (buckets.size > 10_000) {
    for (const [k, times] of buckets) {
      const kept = times.filter((t) => now - t < windowMs);
      if (!kept.length) buckets.delete(k);
      else buckets.set(k, kept);
    }
  }
  return { ok: true };
}

async function assertRateLimitRedis(params: {
  key: string;
  maxPerWindow?: number;
  windowMs?: number;
}): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const max = params.maxPerWindow ?? 10;
  const windowMs = params.windowMs ?? 60_000;
  const redis = getRedisClient();
  if (!redis) return assertRateLimitMemory(params);

  const redisKey = `rl:${params.key}`;
  try {
    if (redis.status !== "ready") {
      await redis.connect().catch(() => {
        throw new Error("redis connect failed");
      });
    }
    // Atomic INCR + conditional PEXPIRE so a failed expire cannot stick the key forever.
    const count = (await redis.eval(
      `
      local n = redis.call('INCR', KEYS[1])
      if n == 1 or redis.call('PTTL', KEYS[1]) < 0 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      return n
      `,
      1,
      redisKey,
      String(windowMs)
    )) as number;
    if (count > max) {
      const ttl = await redis.pttl(redisKey);
      return { ok: false, retryAfterMs: Math.max(50, ttl > 0 ? ttl : windowMs) };
    }
    return { ok: true };
  } catch {
    return assertRateLimitMemory(params);
  }
}

export async function assertRateLimit(params: {
  key: string;
  maxPerWindow?: number;
  windowMs?: number;
}): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  if (getRedisUrl()) {
    return assertRateLimitRedis(params);
  }
  return assertRateLimitMemory(params);
}

/** @deprecated use assertRateLimit (async) — sync memory-only path for tests. */
export function assertRateLimitSync(params: {
  key: string;
  maxPerWindow?: number;
  windowMs?: number;
}): { ok: true } | { ok: false; retryAfterMs: number } {
  return assertRateLimitMemory(params);
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
  redisInitFailed = false;
  if (redisClient) {
    redisClient.disconnect(false);
    redisClient = null;
  }
}

export function __testUseMemoryRateLimitOnly(): void {
  redisInitFailed = true;
}
