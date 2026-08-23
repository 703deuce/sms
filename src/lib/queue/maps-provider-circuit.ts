/**
 * Distributed Bright Data (Maps) circuit breaker.
 * States: closed → open → half_open → closed (or reopen with longer lease).
 *
 * Opens when ≥30% of the last 20 attempts are degradation failures (min 10 samples).
 * While open: no Bright Data calls. After lease: half-open probes decide close vs reopen.
 */

import { getRedisUrl } from "@/lib/queue/config";
import {
  brightDataCircuitLeaseMs,
  brightDataCircuitMinSamples,
  brightDataCircuitOpenDurationMs,
  brightDataCircuitOpenThresholdPercent,
  brightDataCircuitSampleSize,
  brightDataDegradedWindowMs,
} from "@/lib/providers/maps-grid/config";
import {
  isProviderDegradationPattern,
  type MapsFailureCategory,
} from "@/lib/providers/maps-grid/failure-categories";
import type { MapsCircuitState, MapsProviderId } from "@/lib/providers/maps-grid/types";

export type CircuitSnapshot = {
  state: MapsCircuitState;
  openedAt: number;
  expiresAt: number;
  reason: string | null;
  failureCount: number;
  attemptCount: number;
  /** Consecutive opens without a successful close — drives backoff escalation. */
  openStreak: number;
};

type WindowSample = { at: number; failure: boolean; degradation: boolean };

const memoryCircuits = new Map<MapsProviderId, CircuitSnapshot>();
const memoryWindows = new Map<MapsProviderId, WindowSample[]>();

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

function defaultClosed(): CircuitSnapshot {
  return {
    state: "closed",
    openedAt: 0,
    expiresAt: 0,
    reason: null,
    failureCount: 0,
    attemptCount: 0,
    openStreak: 0,
  };
}

function circuitKey(provider: MapsProviderId): string {
  return `lse:provider:${provider}:maps:circuit`;
}

function windowKey(provider: MapsProviderId): string {
  return `lse:provider:${provider}:maps:window`;
}

/**
 * open → half_open when lease expires (probe window).
 * half_open / degraded expiry → closed if nothing else happens.
 */
function applyExpiry(snap: CircuitSnapshot): CircuitSnapshot {
  if (snap.state === "closed") return snap;
  if (snap.expiresAt > 0 && Date.now() > snap.expiresAt) {
    if (snap.state === "open") {
      const now = Date.now();
      return {
        ...snap,
        state: "half_open",
        openedAt: now,
        expiresAt: now + Math.min(brightDataCircuitLeaseMs(), 60_000),
        reason: "half-open probe window",
      };
    }
    return {
      ...defaultClosed(),
      openStreak: snap.state === "half_open" ? snap.openStreak : 0,
    };
  }
  return snap;
}

async function readCircuit(provider: MapsProviderId): Promise<CircuitSnapshot> {
  const redis = await getRedis();
  if (!redis) {
    return applyExpiry(memoryCircuits.get(provider) ?? defaultClosed());
  }
  try {
    const raw = await redis.get(circuitKey(provider));
    if (!raw) return defaultClosed();
    const parsed = JSON.parse(raw) as CircuitSnapshot;
    if (typeof parsed.openStreak !== "number") parsed.openStreak = 0;
    const next = applyExpiry(parsed);
    if (next.state !== parsed.state || next.expiresAt !== parsed.expiresAt) {
      await writeCircuit(provider, next);
    }
    return next;
  } catch {
    return applyExpiry(memoryCircuits.get(provider) ?? defaultClosed());
  }
}

async function writeCircuit(provider: MapsProviderId, snap: CircuitSnapshot): Promise<void> {
  memoryCircuits.set(provider, snap);
  const redis = await getRedis();
  if (!redis) return;
  const ttlSec = Math.max(
    5,
    Math.ceil(Math.max(brightDataCircuitLeaseMs(), snap.expiresAt - Date.now()) / 1000) + 5
  );
  await redis.set(circuitKey(provider), JSON.stringify(snap), "EX", ttlSec).catch(() => {});
}

export async function getMapsProviderCircuit(
  provider: MapsProviderId = "brightdata"
): Promise<CircuitSnapshot> {
  return readCircuit(provider);
}

export async function setMapsProviderCircuit(
  provider: MapsProviderId,
  state: MapsCircuitState,
  reason?: string,
  opts?: { openStreak?: number; leaseMs?: number }
): Promise<CircuitSnapshot> {
  const prev = await readCircuit(provider);
  const now = Date.now();
  let openStreak = prev.openStreak ?? 0;
  if (state === "closed") {
    openStreak = 0;
  } else if (state === "open") {
    openStreak = opts?.openStreak ?? openStreak + 1;
  } else if (opts?.openStreak != null) {
    openStreak = opts.openStreak;
  }

  const leaseMs =
    opts?.leaseMs ??
    (state === "open"
      ? brightDataCircuitOpenDurationMs(Math.max(0, openStreak - 1))
      : state === "half_open"
        ? Math.min(brightDataCircuitLeaseMs(), 60_000)
        : brightDataCircuitLeaseMs());

  const snap: CircuitSnapshot = {
    state,
    openedAt: state === "closed" ? 0 : now,
    expiresAt: state === "closed" ? 0 : now + leaseMs,
    reason: reason ?? null,
    failureCount: 0,
    attemptCount: 0,
    openStreak,
  };
  await writeCircuit(provider, snap);
  console.warn(
    `[MapsCircuit] ${provider} → ${state}` +
      `${reason ? ` (${reason})` : ""}` +
      (state === "open" ? ` lease=${leaseMs}ms streak=${snap.openStreak}` : "")
  );
  return snap;
}

async function pushWindowSample(
  provider: MapsProviderId,
  sample: WindowSample
): Promise<WindowSample[]> {
  const sampleSize = brightDataCircuitSampleSize();
  const windowMs = brightDataDegradedWindowMs();
  const redis = await getRedis();
  if (!redis) {
    const arr = memoryWindows.get(provider) ?? [];
    arr.push(sample);
    const pruned = arr.filter((s) => sample.at - s.at <= windowMs).slice(-sampleSize);
    memoryWindows.set(provider, pruned);
    return pruned;
  }
  try {
    const key = windowKey(provider);
    await redis.lpush(key, JSON.stringify(sample));
    await redis.ltrim(key, 0, sampleSize - 1);
    await redis.pexpire(key, windowMs + 5_000);
    const raw = await redis.lrange(key, 0, sampleSize - 1);
    return raw
      .map((r) => {
        try {
          return JSON.parse(r) as WindowSample;
        } catch {
          return null;
        }
      })
      .filter((s): s is WindowSample => !!s)
      .slice(0, sampleSize);
  } catch {
    const arr = memoryWindows.get(provider) ?? [];
    arr.push(sample);
    const pruned = arr.filter((s) => sample.at - s.at <= windowMs).slice(-sampleSize);
    memoryWindows.set(provider, pruned);
    return pruned;
  }
}

export type DegradationDecision = {
  shouldDegrade: boolean;
  shouldOpen: boolean;
  failureCount: number;
  attemptCount: number;
  degradationCount: number;
  percent: number;
};

export function evaluateDegradationWindow(
  samples: Array<{ failure: boolean; degradation: boolean }>,
  opts?: { minFailures?: number; thresholdPercent?: number; minSamples?: number }
): DegradationDecision {
  const minSamples = opts?.minSamples ?? opts?.minFailures ?? brightDataCircuitMinSamples();
  const threshold = opts?.thresholdPercent ?? brightDataCircuitOpenThresholdPercent();
  const capped = samples.slice(0, brightDataCircuitSampleSize());
  const attemptCount = capped.length;
  const failureCount = capped.filter((s) => s.failure).length;
  const degradationCount = capped.filter((s) => s.degradation).length;
  const percent = attemptCount > 0 ? (degradationCount / attemptCount) * 100 : 0;
  const shouldOpen =
    attemptCount >= minSamples && percent >= threshold && degradationCount >= 1;
  return {
    shouldDegrade: shouldOpen,
    shouldOpen,
    failureCount,
    attemptCount,
    degradationCount,
    percent,
  };
}

/**
 * Record a cell attempt outcome. May open the Bright Data circuit.
 */
export async function recordMapsProviderAttempt(params: {
  provider?: MapsProviderId;
  success: boolean;
  category: MapsFailureCategory;
}): Promise<DegradationDecision & { circuit: CircuitSnapshot }> {
  const provider = params.provider ?? "brightdata";
  const degradation = !params.success && isProviderDegradationPattern(params.category);
  const samples = await pushWindowSample(provider, {
    at: Date.now(),
    failure: !params.success,
    degradation,
  });
  const decision = evaluateDegradationWindow(samples);
  let circuit = await readCircuit(provider);

  if (
    decision.shouldOpen &&
    (circuit.state === "closed" || circuit.state === "degraded" || circuit.state === "half_open")
  ) {
    circuit = await setMapsProviderCircuit(
      provider,
      "open",
      `${decision.degradationCount}/${decision.attemptCount} degradation failures (${Math.round(decision.percent)}%)`
    );
  }

  return { ...decision, circuit };
}

/** True when Bright Data must not accept new work (open only — half_open allows probes). */
export async function shouldSkipBrightDataPrimary(): Promise<boolean> {
  const circuit = await getMapsProviderCircuit("brightdata");
  return circuit.state === "open";
}

/**
 * Wait while circuit is open; when half_open, caller should run probes.
 * Returns the circuit state after any open wait.
 */
export async function waitWhileBrightDataCircuitOpen(
  sleepFn: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<CircuitSnapshot> {
  let circuit = await getMapsProviderCircuit("brightdata");
  while (circuit.state === "open") {
    const waitMs = Math.max(250, Math.min(circuit.expiresAt - Date.now() + 50, 30_000));
    console.warn(
      `[MapsCircuit] Bright Data open — pausing ${waitMs}ms (expires in ${Math.max(0, circuit.expiresAt - Date.now())}ms)`
    );
    await sleepFn(waitMs);
    circuit = await getMapsProviderCircuit("brightdata");
  }
  return circuit;
}

export async function closeBrightDataCircuit(reason: string): Promise<CircuitSnapshot> {
  return setMapsProviderCircuit("brightdata", "closed", reason, { openStreak: 0 });
}

export async function reopenBrightDataCircuit(reason: string): Promise<CircuitSnapshot> {
  return setMapsProviderCircuit("brightdata", "open", reason);
}

export function __resetMapsProviderCircuitForTests(): void {
  memoryCircuits.clear();
  memoryWindows.clear();
}
