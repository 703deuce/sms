/**
 * Distributed per-provider Maps concurrency + start-rate limiter.
 * Shared across all workers / scans / retries. Falls back to in-process when Redis is absent.
 *
 * Bright Data paced trial: 10 in-flight + 10 starts per rolling minute.
 * Other providers keep a 1-second start window.
 */

import { getRedisUrl } from "@/lib/queue/config";
import type { MapsProviderId } from "@/lib/providers/maps-grid/types";
import {
  brightDataGlobalConcurrency,
  brightDataStartRatePerMin,
  dataForSeoMapsConcurrency,
  scrapingDogMapsConcurrency,
} from "@/lib/providers/maps-grid/config";

type Slot = { release: () => Promise<void> };

type MemoryState = {
  inFlight: number;
  windowStart: number;
  startsInWindow: number;
};

const memoryByProvider = new Map<MapsProviderId, MemoryState>();

let sharedRedis: import("ioredis").default | null = null;
let sharedRedisConnecting: Promise<import("ioredis").default | null> | null = null;

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

export function mapsProviderMaxInFlight(provider: MapsProviderId): number {
  switch (provider) {
    case "brightdata":
      return brightDataGlobalConcurrency();
    case "dataforseo":
      return dataForSeoMapsConcurrency();
    case "scrapingdog":
      return scrapingDogMapsConcurrency();
  }
}

/** Rate window length — Bright Data uses 1 minute; others 1 second. */
export function mapsProviderRateWindowMs(provider: MapsProviderId): number {
  if (provider === "brightdata") {
    const n = Number(process.env.BRIGHTDATA_RATE_WINDOW_MS ?? 60_000);
    return Number.isFinite(n) && n >= 1_000 ? Math.floor(n) : 60_000;
  }
  return 1_000;
}

/** Max starts allowed inside the provider rate window. */
export function mapsProviderStartRate(provider: MapsProviderId): number {
  if (provider === "brightdata") {
    const legacySec = Number(process.env.MAPS_BRIGHTDATA_START_RATE_PER_SEC ?? "");
    if (Number.isFinite(legacySec) && legacySec > 0) {
      // Convert legacy per-sec into the minute window when using 60s windows.
      const windowMs = mapsProviderRateWindowMs(provider);
      if (windowMs >= 60_000) return Math.max(1, Math.floor(legacySec * (windowMs / 1000)));
      return Math.floor(legacySec);
    }
    return brightDataStartRatePerMin();
  }
  const envKey = `MAPS_${provider.toUpperCase()}_START_RATE_PER_SEC`;
  const n = Number(process.env[envKey]);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return Math.min(mapsProviderMaxInFlight(provider) * 4, 200);
}

/** @deprecated Prefer mapsProviderStartRate — kept for older callers/tests. */
export function mapsProviderStartRatePerSec(provider: MapsProviderId): number {
  if (provider === "brightdata") {
    const windowMs = mapsProviderRateWindowMs(provider);
    const perWindow = mapsProviderStartRate(provider);
    if (windowMs >= 60_000) return Math.max(1, Math.ceil(perWindow / (windowMs / 1000)));
    return perWindow;
  }
  return mapsProviderStartRate(provider);
}

function memoryState(provider: MapsProviderId): MemoryState {
  let state = memoryByProvider.get(provider);
  if (!state) {
    state = { inFlight: 0, windowStart: Date.now(), startsInWindow: 0 };
    memoryByProvider.set(provider, state);
  }
  return state;
}

async function acquireMemorySlot(provider: MapsProviderId, timeoutMs: number): Promise<Slot> {
  const deadline = Date.now() + timeoutMs;
  const maxInFlight = mapsProviderMaxInFlight(provider);
  const startRate = mapsProviderStartRate(provider);
  const windowMs = mapsProviderRateWindowMs(provider);
  const state = memoryState(provider);

  while (Date.now() < deadline) {
    const now = Date.now();
    if (now - state.windowStart >= windowMs) {
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
  throw new Error(`${provider} capacity timeout — global limiter full`);
}

async function acquireRedisSlot(provider: MapsProviderId, timeoutMs: number): Promise<Slot> {
  const redis = await getRedis();
  if (!redis) return acquireMemorySlot(provider, timeoutMs);

  const deadline = Date.now() + timeoutMs;
  const maxInFlight = mapsProviderMaxInFlight(provider);
  const startRate = mapsProviderStartRate(provider);
  const windowMs = mapsProviderRateWindowMs(provider);
  const inFlightKey = `lse:provider:${provider}:maps:inflight`;
  const rateKeyPrefix = `lse:provider:${provider}:maps:starts:`;

  while (Date.now() < deadline) {
    const bucket = Math.floor(Date.now() / windowMs);
    const rateKey = `${rateKeyPrefix}${bucket}`;
    const multi = redis.multi();
    multi.incr(inFlightKey);
    multi.incr(rateKey);
    multi.expire(rateKey, Math.max(2, Math.ceil(windowMs / 1000) + 1));
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

export async function acquireMapsProviderSlot(
  provider: MapsProviderId,
  timeoutMs = 30_000
): Promise<Slot> {
  if (getRedisUrl()) return acquireRedisSlot(provider, timeoutMs);
  return acquireMemorySlot(provider, timeoutMs);
}

/** Current in-flight count (best-effort; memory fallback when Redis unavailable). */
export async function mapsProviderInFlight(provider: MapsProviderId): Promise<number> {
  const redis = await getRedis();
  if (!redis) return memoryState(provider).inFlight;
  const n = await redis.get(`lse:provider:${provider}:maps:inflight`).catch(() => "0");
  return Number(n ?? 0) || 0;
}

/** Test helper — reset in-process limiter state. */
export function __resetMapsProviderLimiterForTests(): void {
  memoryByProvider.clear();
}
