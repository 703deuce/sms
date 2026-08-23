/**
 * Cross-worker provider throttles (Twilio / Brevo), mirroring Bright Data.
 * When REDIS_URL is set, coordinates via Redis; otherwise in-process only.
 */

import {
  brevoMaxInFlight,
  brevoStartRatePerSec,
  getRedisUrl,
  twilioMaxInFlight,
  twilioStartRatePerSec,
} from "@/lib/queue/config";

export type ProviderLimiterName = "twilio" | "brevo";

type Slot = { release: () => Promise<void> };

type MemoryState = { inFlight: number; windowStart: number; startsInWindow: number };

const memory: Record<ProviderLimiterName, MemoryState> = {
  twilio: { inFlight: 0, windowStart: Date.now(), startsInWindow: 0 },
  brevo: { inFlight: 0, windowStart: Date.now(), startsInWindow: 0 },
};

let sharedRedis: import("ioredis").default | null = null;
let sharedRedisConnecting: Promise<import("ioredis").default | null> | null = null;

function limitsFor(provider: ProviderLimiterName): { maxInFlight: number; startRate: number } {
  if (provider === "twilio") {
    return { maxInFlight: twilioMaxInFlight(), startRate: twilioStartRatePerSec() };
  }
  return { maxInFlight: brevoMaxInFlight(), startRate: brevoStartRatePerSec() };
}

async function getRedis(): Promise<import("ioredis").default | null> {
  const url = getRedisUrl();
  if (!url) return null;
  if (sharedRedis && sharedRedis.status !== "end" && sharedRedis.status !== "close") {
    return sharedRedis;
  }
  if (sharedRedisConnecting) return sharedRedisConnecting;

  sharedRedisConnecting = (async () => {
    try {
      const IORedis = (await import("ioredis")).default;
      const client = new IORedis(url, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      if (client.status === "wait") await client.connect();
      sharedRedis = client;
      client.on("end", () => {
        if (sharedRedis === client) sharedRedis = null;
      });
      return client;
    } catch {
      sharedRedis = null;
      return null;
    } finally {
      sharedRedisConnecting = null;
    }
  })();

  return sharedRedisConnecting;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquireMemorySlot(
  provider: ProviderLimiterName,
  timeoutMs: number
): Promise<Slot> {
  const deadline = Date.now() + timeoutMs;
  const { maxInFlight, startRate } = limitsFor(provider);
  const state = memory[provider];

  while (Date.now() < deadline) {
    const now = Date.now();
    if (now - state.windowStart >= 1000) {
      state.windowStart = now;
      state.startsInWindow = 0;
    }
    if (state.inFlight < maxInFlight && state.startsInWindow < startRate) {
      state.inFlight += 1;
      state.startsInWindow += 1;
      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          state.inFlight = Math.max(0, state.inFlight - 1);
        },
      };
    }
    await sleep(20);
  }
  throw new Error(`${provider} capacity timeout — provider limiter full`);
}

async function acquireRedisSlot(
  provider: ProviderLimiterName,
  timeoutMs: number
): Promise<Slot> {
  const redis = await getRedis();
  if (!redis) return acquireMemorySlot(provider, timeoutMs);

  const deadline = Date.now() + timeoutMs;
  const { maxInFlight, startRate } = limitsFor(provider);
  const inFlightKey = `lse:${provider}:inflight`;
  const rateKeyPrefix = `lse:${provider}:starts:`;

  while (Date.now() < deadline) {
    const second = Math.floor(Date.now() / 1000);
    const rateKey = `${rateKeyPrefix}${second}`;
    const multi = redis.multi();
    multi.incr(inFlightKey);
    multi.incr(rateKey);
    multi.expire(rateKey, 2);
    const results = await multi.exec();
    const inFlight = Number(results?.[0]?.[1] ?? 0);
    const starts = Number(results?.[1]?.[1] ?? 0);

    if (inFlight <= maxInFlight && starts <= startRate) {
      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          await redis.decr(inFlightKey).catch(() => {});
        },
      };
    }

    await redis.decr(inFlightKey).catch(() => {});
    await redis.decr(rateKey).catch(() => {});
    await sleep(25);
  }
  throw new Error(`${provider} capacity timeout — global Redis limiter full`);
}

/** Acquire one Twilio/Brevo start slot (rate + in-flight). */
export async function acquireProviderSlot(
  provider: ProviderLimiterName,
  timeoutMs = 30_000
): Promise<Slot> {
  if (getRedisUrl()) return acquireRedisSlot(provider, timeoutMs);
  return acquireMemorySlot(provider, timeoutMs);
}

export function providerLimiterConfig(provider: ProviderLimiterName) {
  return limitsFor(provider);
}
