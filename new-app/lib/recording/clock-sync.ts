export type ClockSample = {
  rttMs: number
  offsetMs: number
}

/** hostClock ≈ localClock + offsetMs (LiveKit brief §4.6). */
export function offsetFromSample(t0: number, t1: number, hostNow: number): ClockSample {
  const rttMs = t1 - t0
  const offsetMs = hostNow - (t0 + t1) / 2
  return { rttMs, offsetMs }
}

export function bestOffsetFromSamples(samples: ClockSample[]): number {
  if (!samples.length) return 0
  const best = samples.reduce((a, b) => (b.rttMs < a.rttMs ? b : a))
  return best.offsetMs
}

export function hostNowFromLocal(localNow: number, offsetMs: number): number {
  return localNow + offsetMs
}

export function scheduleAtHostMs(startAtHostMs: number, offsetMs: number, fn: () => void): () => void {
  const localTarget = startAtHostMs - offsetMs
  const delay = Math.max(0, localTarget - performance.timeOrigin - performance.now())
  const id = window.setTimeout(fn, delay)
  return () => window.clearTimeout(id)
}
