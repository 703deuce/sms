/**
 * G4c scene split: find shot changes in the main video (in the browser, no AI, no credits) and
 * offer them as Video-lane splits the user confirms.
 *
 * Signature per sampled frame = 64-bin RGB histogram (4 levels per channel) + 4×4 grid of mean
 * luma. Distance = 0.6 × histogram L1/2 + 0.4 × mean |grid Δ| (both 0..1). A sample is a cut when
 * its distance to the previous sample is ≥ `threshold` AND ≥ `ratio` × the median distance of its
 * neighbours (so steady motion / pans do not fire), with at least `minGapMs` between cuts. Each cut
 * is then bisected between the two samples down to one frame (refineCut).
 */
export type SceneSig = { hist: Float32Array; grid: Float32Array }
export type SceneSample = { t: number; sig: SceneSig }
export type SceneCut = { t: number; score: number }

export const SCENE_LEVELS = 4
export const SCENE_GRID = 4
export const SCENE_STEP_MS = 200
export const SCENE_MAX_SAMPLES = 1500
export const SCENE_DEFAULTS = { threshold: 0.3, ratio: 3, minGapMs: 600, window: 6 }

export function frameSig(px: ArrayLike<number>, w: number, h: number): SceneSig {
  const L = SCENE_LEVELS
  const G = SCENE_GRID
  const hist = new Float32Array(L * L * L)
  const grid = new Float32Array(G * G)
  const cnt = new Float32Array(G * G)
  let n = 0
  for (let y = 0; y < h; y++) {
    const gy = Math.min(G - 1, Math.floor((y * G) / h))
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = px[i]!
      const g = px[i + 1]!
      const b = px[i + 2]!
      hist[((r * L) >> 8) * L * L + ((g * L) >> 8) * L + ((b * L) >> 8)]! += 1
      const gx = Math.min(G - 1, Math.floor((x * G) / w))
      grid[gy * G + gx]! += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      cnt[gy * G + gx]! += 1
      n++
    }
  }
  for (let i = 0; i < hist.length; i++) hist[i] = hist[i]! / Math.max(1, n)
  for (let i = 0; i < grid.length; i++) grid[i] = grid[i]! / Math.max(1, cnt[i]!)
  return { hist, grid }
}

export function sigDiff(a: SceneSig, b: SceneSig): number {
  let h = 0
  for (let i = 0; i < a.hist.length; i++) h += Math.abs(a.hist[i]! - b.hist[i]!)
  let g = 0
  for (let i = 0; i < a.grid.length; i++) g += Math.abs(a.grid[i]! - b.grid[i]!)
  return 0.6 * (h / 2) + 0.4 * (g / a.grid.length)
}

function median(v: number[]): number {
  if (!v.length) return 0
  const s = [...v].sort((p, q) => p - q)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Cut candidates (time of the first sample of the new shot). Samples must be sorted by t. */
export function detectCuts(samples: readonly SceneSample[], opts: Partial<typeof SCENE_DEFAULTS> = {}): SceneCut[] {
  const o = { ...SCENE_DEFAULTS, ...opts }
  const d: number[] = [0]
  for (let i = 1; i < samples.length; i++) d.push(sigDiff(samples[i - 1]!.sig, samples[i]!.sig))
  const out: SceneCut[] = []
  for (let i = 1; i < samples.length; i++) {
    const s = d[i]!
    if (s < o.threshold) continue
    const neigh: number[] = []
    for (let j = Math.max(1, i - o.window); j <= Math.min(samples.length - 1, i + o.window); j++) if (j !== i) neigh.push(d[j]!)
    if (neigh.length && s < o.ratio * median(neigh)) continue
    const t = samples[i]!.t
    const last = out[out.length - 1]
    if (last && t - last.t < o.minGapMs) {
      if (s > last.score) out[out.length - 1] = { t, score: s }
      continue
    }
    out.push({ t, score: s })
  }
  return out
}

/**
 * Bisect a cut between sample times lo (old shot) and hi (new shot) to `frameMs` precision.
 * Returns the time of the first frame of the new shot.
 */
export async function refineCut(
  lo: number,
  hi: number,
  sigLo: SceneSig,
  sigHi: SceneSig,
  sigAt: (t: number) => Promise<SceneSig | null>,
  frameMs = 1000 / 30,
): Promise<number> {
  let a = lo
  let b = hi
  for (let k = 0; k < 8 && b - a > frameMs * 1.01; k++) {
    const m = (a + b) / 2
    const s = await sigAt(m)
    if (!s) break
    if (sigDiff(s, sigLo) <= sigDiff(s, sigHi)) a = m
    else b = m
  }
  return Math.round(b)
}

/** Sample times (source ms) over keep segments, SCENE_STEP_MS apart (wider for long videos). */
export function sampleTimes(segments: readonly (readonly [number, number])[], stepMs = SCENE_STEP_MS, max = SCENE_MAX_SAMPLES): number[] {
  const total = segments.reduce((a, [x, y]) => a + Math.max(0, y - x), 0)
  const step = Math.max(stepMs, Math.ceil(total / max))
  const out: number[] = []
  for (const [x, y] of segments) for (let t = x; t < y; t += step) out.push(Math.round(t))
  return out
}

/** Keep cuts that leave ≥ minSegMs to segment edges and to existing / other splits. */
export function usableCuts(cuts: readonly number[], segments: readonly (readonly [number, number])[], existing: readonly number[], minSegMs: number): number[] {
  const taken = [...existing]
  const out: number[] = []
  for (const c of [...cuts].sort((p, q) => p - q)) {
    const seg = segments.find(([x, y]) => c > x && c < y)
    if (!seg || c - seg[0] < minSegMs || seg[1] - c < minSegMs) continue
    if (taken.some((s) => Math.abs(s - c) < minSegMs)) continue
    taken.push(c)
    out.push(c)
  }
  return out
}

/** G4cfix: coarse pass spacing / cap (a 12-min clip = 400 samples ≈ 1.8 s apart; refineCut bisects). */
export const SCENE_FAST_STEP_MS = 250
export const SCENE_FAST_MAX = 400
/** G4cfix: scan frames this wide (the signature is a 4×4 grid + a 64-bin histogram). */
export const SCENE_SCAN_W = 64

/** G4cfix: keep segments clipped to [a, b) (scan only the selected item / range). */
export function clipRanges(segments: readonly (readonly [number, number])[], a: number, b: number): [number, number][] {
  const out: [number, number][] = []
  for (const [x, y] of segments) {
    const lo = Math.max(x, a)
    const hi = Math.min(y, b)
    if (hi > lo) out.push([lo, hi])
  }
  return out
}
