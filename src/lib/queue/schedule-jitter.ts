/**
 * Spread a group of due schedules across a window so midnight floods
 * cannot enqueue thousands of jobs in the same second.
 */
export function scheduleJitterMs(opts: {
  /** Inclusive start of the distribution window. */
  windowStartMs: number;
  /** Window length in ms (e.g. 3_600_000 for one hour). */
  windowMs: number;
  /** Stable id for deterministic placement (schedule id / org id). */
  seed: string;
  /** Optional extra randomness 0–1 (default 0.15 of slot). */
  jitterRatio?: number;
}): number {
  const windowMs = Math.max(1_000, opts.windowMs);
  const hash = fnv1a(opts.seed);
  const slot = hash % windowMs;
  const jitterRatio = opts.jitterRatio ?? 0.15;
  const jitter = Math.floor((hash % 1000) * jitterRatio);
  return opts.windowStartMs + slot + jitter;
}

/** Deterministic delay from "now" within the next window. */
export function delayWithinWindowMs(seed: string, windowMs: number): number {
  const start = Date.now();
  return Math.max(0, scheduleJitterMs({ windowStartMs: start, windowMs, seed }) - start);
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
