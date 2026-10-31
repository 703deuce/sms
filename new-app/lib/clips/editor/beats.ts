/**
 * G2 local beat detection (no paid API, runs in the browser on the decoded music).
 * Energy-flux onsets on 10 ms frames → tempo by autocorrelation (log-normal prior around
 * 120 BPM) → beat phase by comb scoring → each beat nudged to the strongest nearby onset.
 * Output is media ms of the source file; `beatsToOutput` places them on the timeline.
 */

export const BEAT_FRAME_MS = 10
const MIN_BPM = 60
const MAX_BPM = 200
/** Below this length there is not enough music to call a tempo. */
const MIN_SECONDS = 4
const MAX_BEATS = 4000

export type BeatGrid = { bpm: number; beatsMs: number[] }

/** Onset strength per 10 ms frame (half-wave rectified log-energy rise, local mean removed). */
export function frameHop(sampleRate: number): number {
  return Math.max(1, Math.round((sampleRate * BEAT_FRAME_MS) / 1000))
}

export function onsetEnvelope(samples: Float32Array, sampleRate: number): Float32Array {
  const hop = frameHop(sampleRate)
  const n = Math.floor(samples.length / hop)
  const le = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let acc = 0
    const a = i * hop
    for (let j = a; j < a + hop; j++) {
      const v = samples[j]!
      acc += v * v
    }
    le[i] = Math.log1p(1000 * Math.sqrt(acc / hop))
  }
  const raw = new Float32Array(n)
  for (let i = 1; i < n; i++) raw[i] = Math.max(0, le[i]! - le[i - 1]!)
  // Remove a 0.5 s moving mean so steady loud passages do not read as onsets.
  const half = 25
  const out = new Float32Array(n)
  let sum = 0
  let cnt = 0
  for (let i = 0; i < Math.min(n, half); i++) {
    sum += raw[i]!
    cnt++
  }
  for (let i = 0; i < n; i++) {
    const add = i + half
    if (add < n) {
      sum += raw[add]!
      cnt++
    }
    const drop = i - half - 1
    if (drop >= 0) {
      sum -= raw[drop]!
      cnt--
    }
    out[i] = Math.max(0, raw[i]! - sum / Math.max(1, cnt))
  }
  return out
}

/** Tempo period in frames (fractional) from the onset envelope, or null when nothing periodic. */
export function tempoPeriod(onset: Float32Array, frameMs = BEAT_FRAME_MS): number | null {
  const n = onset.length
  const minLag = Math.floor(60_000 / MAX_BPM / frameMs)
  const maxLag = Math.ceil(60_000 / MIN_BPM / frameMs)
  if (n < maxLag * 3) return null
  let mean = 0
  for (let i = 0; i < n; i++) mean += onset[i]!
  mean /= n
  if (mean <= 1e-6) return null
  const ac = new Float64Array(maxLag + 2)
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let acc = 0
    for (let i = lag; i < n; i++) acc += onset[i]! * onset[i - lag]!
    ac[lag] = acc / (n - lag)
  }
  let best = -1
  let bestScore = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (!(ac[lag]! >= ac[lag - 1]! && ac[lag]! >= ac[lag + 1]!)) continue
    const bpm = 60_000 / (lag * frameMs)
    const prior = Math.exp(-0.5 * Math.log2(bpm / 120) ** 2)
    const score = ac[lag]! * prior
    if (score > bestScore) {
      bestScore = score
      best = lag
    }
  }
  if (best < 0) return null
  // Parabolic refinement to a fractional lag.
  const y0 = ac[best - 1]!
  const y1 = ac[best]!
  const y2 = ac[best + 1]!
  const den = y0 - 2 * y1 + y2
  const shift = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0
  return best + shift
}

/** Beats (media ms) of mono samples. Empty grid when silent, too short or not periodic. */
export function detectBeats(samples: Float32Array, sampleRate: number): BeatGrid {
  const empty: BeatGrid = { bpm: 0, beatsMs: [] }
  if (!samples.length || sampleRate <= 0 || samples.length / sampleRate < MIN_SECONDS) return empty
  const onset = onsetEnvelope(samples, sampleRate)
  // Real frame length (the hop is a whole number of samples).
  const frameMs = (frameHop(sampleRate) * 1000) / sampleRate
  const period = tempoPeriod(onset, frameMs)
  if (period == null) return empty
  const n = onset.length
  // Phase: the comb offset that collects the most onset energy.
  let bestPhase = 0
  let bestScore = -1
  for (let ph = 0; ph < Math.ceil(period); ph++) {
    let s = 0
    for (let t = ph; t < n; t += period) {
      const k = Math.round(t)
      s += Math.max(onset[k] ?? 0, 0.5 * (onset[k - 1] ?? 0), 0.5 * (onset[k + 1] ?? 0))
    }
    if (s > bestScore) {
      bestScore = s
      bestPhase = ph
    }
  }
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, onset[i]!)
  const floor = peak * 0.15
  const win = Math.max(1, Math.round(period * 0.1))
  const beats: number[] = []
  let t = bestPhase
  while (t < n && beats.length < MAX_BEATS) {
    const c = Math.round(t)
    let at = c
    let v = onset[c] ?? 0
    for (let k = c - win; k <= c + win; k++) {
      if (k < 0 || k >= n) continue
      if (onset[k]! > v) {
        v = onset[k]!
        at = k
      }
    }
    const use = v >= floor ? at : c
    beats.push(Math.round(use * frameMs))
    // Follow the music (small tempo drift) but never by more than the search window.
    t = use + period
  }
  return { bpm: Math.round((60_000 / (period * frameMs)) * 10) / 10, beatsMs: beats }
}

/** Mono mix of an AudioBuffer-like (all channels averaged). */
export function monoSamples(buf: { numberOfChannels: number; length: number; getChannelData: (c: number) => Float32Array }): Float32Array {
  if (buf.numberOfChannels <= 1) return buf.getChannelData(0)
  const out = new Float32Array(buf.length)
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c)
    for (let i = 0; i < out.length; i++) out[i]! += ch[i]! / buf.numberOfChannels
  }
  return out
}

/**
 * Media beats → OUTPUT ms for a clip that plays media from `inMs` at output `startMs` until
 * `endMs`; a looping clip (G2 Fit to length) repeats its media every `mediaMs`.
 */
export function beatsToOutput(
  beatsMs: readonly number[],
  clip: { startMs: number; endMs: number; inMs: number },
  mediaMs: number | null,
  loop = false,
): number[] {
  const out: number[] = []
  if (!beatsMs.length || clip.endMs <= clip.startMs) return out
  const cycles = loop && mediaMs != null && mediaMs > 0 ? Math.ceil((clip.endMs - clip.startMs + clip.inMs) / mediaMs) + 1 : 1
  for (let c = 0; c < cycles && out.length < MAX_BEATS; c++) {
    for (const b of beatsMs) {
      const o = clip.startMs + c * (mediaMs ?? 0) + b - clip.inMs
      if (o >= clip.startMs && o < clip.endMs) out.push(Math.round(o))
    }
  }
  return out
}
