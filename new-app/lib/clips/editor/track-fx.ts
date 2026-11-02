/**
 * G1c: track-level effects (Vegas track FX / Premiere Audio Track Mixer). One chain per track,
 * applied ONCE to everything on it (new items get it automatically). Additive `edits.trackFx`.
 *
 * Keys: 'voice' (main sound), 'music', an audio track id (`au1`, `au2`…: the SFX on it are mixed
 * into one bus, then the chain runs on the bus), or an overlay track id (`ov…`: color look for
 * every B-roll item on it that has no look of its own).
 *
 * Fixed chain order (both sides): noise reduction → high-pass → low shelf → mid peak → high shelf
 * → compressor → loudness gain (LUFS target) → limiter.
 *
 * Export: worker clips_worker/track_fx.py builds afftdn / highpass / bass / equalizer / treble /
 * acompressor / volume / alimiter (all in ffmpeg 5.1). The LUFS target is a LINEAR gain = target −
 * measured integrated loudness of the pre-gain chain output (ffmpeg loudnorm measures it), so the
 * preview can apply the same gain from its own BS.1770 measurement (`integratedLufs`).
 * Preview: Web Audio (`webAudioPlan`). Biquads use the same analog prototypes (RBJ cookbook) as
 * ffmpeg's; the compressor's built-in Web Audio make-up gain is cancelled so only the user make-up
 * remains. Noise reduction has no Web Audio equivalent: export-only (the panel says so).
 * Parity fixture: worker/tests/fixtures/g1c_trackfx_parity.json (vitest + pytest).
 */
import { isIdentitySpec, normalizeColorSpec, type ColorSpec } from '@/lib/clips/editor/color'
import { panGains } from '@/lib/clips/audio'

export type TrackEq = { hp?: number; low?: number; mid?: number; midHz?: number; high?: number }
export type TrackComp = { threshold: number; ratio: number; attack: number; release: number; makeup: number }
export type TrackVfxType = 'echo' | 'reverb' | 'robot' | 'telephone'
export type TrackVfx = { type: TrackVfxType; amount?: number }
export type TrackFx = {
  track: string
  bypass?: true
  /** afftdn noise reduction, dB (6–40). */
  nr?: number
  /** Q3.4: dry/wet mix for noise reduction on export (0–1). */
  nrMix?: number
  eq?: TrackEq
  comp?: TrackComp
  /** Limiter ceiling, dBFS (−24…0). */
  limit?: number
  /** Integrated loudness target, LUFS (−36…−8). */
  lufs?: number
  /** AU-11 de-esser intensity 0–100 (export-only). */
  deess?: number
  /** AU-31 voice effect (export-only for telephone uses preview biquads). */
  vfx?: TrackVfx
  /** AU-12 voice-track balance pan only. */
  pan?: number
  /** Overlay tracks: color look. */
  color?: ColorSpec
}

export const FX_LIMITS = {
  nr: [6, 40, 12],
  hp: [20, 400, 80],
  shelf: [-12, 12, 0],
  midHz: [200, 8000, 2500],
  threshold: [-60, 0, -18],
  ratio: [1, 20, 3],
  attack: [0.1, 200, 10],
  release: [10, 2000, 150],
  makeup: [0, 24, 0],
  limit: [-24, 0, -1],
  lufs: [-36, -8, -16],
  deess: [0, 100, 50],
  vfxAmount: [0, 100, 50],
  pan: [-100, 100, 0],
} as const
export const EQ_LOW_HZ = 120
export const EQ_HIGH_HZ = 8000
export const EQ_MID_Q = 1
/** Compressor knee width (dB), centred on the threshold (ffmpeg acompressor's knee is centred). */
export const COMP_KNEE_DB = 6
export const LUFS_GAIN_MAX_DB = 24
export const AUDIO_FX_KEYS_FIXED = ['voice', 'music'] as const

const KEY_RE = /^[A-Za-z0-9_-]{1,24}$/
const r2 = (v: number) => Math.round(v * 100) / 100
function num(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}
function clampLim(v: unknown, lim: readonly [number, number, number]): number | null {
  const n = num(v)
  return n == null ? null : r2(Math.min(lim[1], Math.max(lim[0], n)))
}

export function isOverlayFxKey(key: string): boolean {
  return /^ov\d+$/.test(key)
}
export function isAudioFxKey(key: string): boolean {
  return key === 'voice' || key === 'music' || /^au\d+$/.test(key)
}

export function normalizeTrackFxOne(raw: unknown): TrackFx | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const track = typeof o.track === 'string' ? o.track : ''
  if (!KEY_RE.test(track) || !(isAudioFxKey(track) || isOverlayFxKey(track))) return null
  const out: TrackFx = { track }
  if (isAudioFxKey(track)) {
    const nr = clampLim(o.nr, FX_LIMITS.nr)
    if (nr != null) out.nr = nr
    if (nr != null) {
      const nrMix = num(o.nrMix)
      if (nrMix != null) out.nrMix = Math.min(1, Math.max(0, r2(nrMix)))
    }
    if (o.eq && typeof o.eq === 'object') {
      const e = o.eq as Record<string, unknown>
      const eq: TrackEq = {}
      const hp = clampLim(e.hp, FX_LIMITS.hp)
      if (hp != null) eq.hp = Math.round(hp)
      for (const k of ['low', 'mid', 'high'] as const) {
        const g = clampLim(e[k], FX_LIMITS.shelf)
        if (g != null && g !== 0) eq[k] = g
      }
      const mh = clampLim(e.midHz, FX_LIMITS.midHz)
      if (eq.mid != null) eq.midHz = Math.round(mh ?? FX_LIMITS.midHz[2])
      if (Object.keys(eq).length) out.eq = eq
    }
    if (o.comp && typeof o.comp === 'object') {
      const c = o.comp as Record<string, unknown>
      const pick = (k: keyof TrackComp) => clampLim(c[k], FX_LIMITS[k]) ?? FX_LIMITS[k][2]
      out.comp = { threshold: pick('threshold'), ratio: pick('ratio'), attack: pick('attack'), release: pick('release'), makeup: pick('makeup') }
    }
    const lim = clampLim(o.limit, FX_LIMITS.limit)
    if (lim != null) out.limit = lim
    const lufs = clampLim(o.lufs, FX_LIMITS.lufs)
    if (lufs != null) out.lufs = Math.round(lufs)
    const deess = clampLim(o.deess, FX_LIMITS.deess)
    if (deess != null) out.deess = deess
    const vfxRaw = o.vfx
    if (vfxRaw && typeof vfxRaw === 'object') {
      const t = (vfxRaw as { type?: unknown }).type
      if (t === 'echo' || t === 'reverb' || t === 'robot' || t === 'telephone') {
        const entry: TrackVfx = { type: t }
        if (t !== 'telephone') {
          const amt = clampLim((vfxRaw as { amount?: unknown }).amount, FX_LIMITS.vfxAmount)
          entry.amount = amt ?? FX_LIMITS.vfxAmount[2]
        }
        out.vfx = entry
      }
    }
    if (track === 'voice') {
      const pan = clampLim(o.pan, FX_LIMITS.pan)
      if (pan != null && pan !== 0) out.pan = Math.round(pan)
    }
  } else {
    const color = normalizeColorSpec(o.color)
    if (color && !isIdentitySpec(color)) out.color = color
  }
  if (o.bypass === true) out.bypass = true
  return hasFx(out) ? out : null
}

export function normalizeTrackFx(raw: unknown, trackIds?: ReadonlySet<string>): TrackFx[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const by = new Map<string, TrackFx>()
  for (const r of raw) {
    const fx = normalizeTrackFxOne(r)
    if (!fx) continue
    if (trackIds && fx.track !== 'voice' && fx.track !== 'music' && !trackIds.has(fx.track)) continue
    by.set(fx.track, fx)
  }
  const out = [...by.values()].sort((a, b) => (a.track < b.track ? -1 : a.track > b.track ? 1 : 0))
  return out.length ? out : undefined
}

export function hasFx(fx: TrackFx | null | undefined): boolean {
  if (!fx) return false
  return (
    fx.nr != null ||
    fx.eq != null ||
    fx.comp != null ||
    fx.limit != null ||
    fx.lufs != null ||
    fx.color != null ||
    fx.deess != null ||
    fx.vfx != null ||
    fx.pan != null
  )
}

/** Active (not bypassed) audio processing on this key. */
export function audioFxActive(fx: TrackFx | null | undefined): fx is TrackFx {
  return Boolean(fx && !fx.bypass && isAudioFxKey(fx.track) && hasFx(fx))
}

export function trackFxFor(edits: { trackFx?: TrackFx[] }, key: string): TrackFx | undefined {
  return edits.trackFx?.find((f) => f.track === key)
}

/** Replace one track's chain (null removes it). Returns a new array (undefined when empty). */
export function withTrackFx(list: TrackFx[] | undefined, key: string, fx: Omit<TrackFx, 'track'> | null): TrackFx[] | undefined {
  const rest = (list ?? []).filter((f) => f.track !== key)
  const one = fx ? normalizeTrackFxOne({ ...fx, track: key }) : null
  return normalizeTrackFx(one ? [...rest, one] : rest)
}

// ---------------------------------------------------------------------------
// Preview plan (Web Audio) — pure so the numbers are unit-tested against the fixture
// ---------------------------------------------------------------------------

export type FxNode =
  | { type: 'biquad'; kind: 'highpass' | 'lowshelf' | 'peaking' | 'highshelf' | 'lowpass'; f: number; q: number; gain: number }
  | { type: 'comp'; threshold: number; knee: number; ratio: number; attack: number; release: number }
  | { type: 'gain'; db: number }
  | { type: 'pan'; gl: number; gr: number }
  | { type: 'delays'; taps: { s: number; g: number }[]; dry: number }
  | { type: 'ring'; hz: number; m: number }

/** Web Audio Q for a 2nd-order high-pass is in dB: 20·log10(0.7071) gives the Butterworth Q. */
export const WEB_HP_Q_DB = Math.round(20 * Math.log10(Math.SQRT1_2) * 1e4) / 1e4

/**
 * The make-up gain Chrome / Firefox add inside DynamicsCompressorNode (Chromium kernel:
 * (1 / gain at 0 dBFS)^0.6), estimated with the equivalent hard knee. Cancelled in the plan.
 */
export function webAutoMakeupDb(thresholdDb: number, ratio: number): number {
  const fullRange = thresholdDb * (1 - 1 / Math.max(1, ratio)) // ≤ 0 dB
  return -0.6 * fullRange
}

/** Nodes for one chain before the LUFS gain (`stage: 'pre'`) or the whole chain. */
export function webAudioPlan(fx: TrackFx, lufsGainDb: number | null = null, stage: 'pre' | 'all' = 'all'): FxNode[] {
  const out: FxNode[] = []
  if (fx.bypass) return out
  const eq = fx.eq
  if (eq?.hp != null) out.push({ type: 'biquad', kind: 'highpass', f: eq.hp, q: WEB_HP_Q_DB, gain: 0 })
  if (eq?.low != null) out.push({ type: 'biquad', kind: 'lowshelf', f: EQ_LOW_HZ, q: 1, gain: eq.low })
  if (eq?.mid != null) out.push({ type: 'biquad', kind: 'peaking', f: eq.midHz ?? FX_LIMITS.midHz[2], q: EQ_MID_Q, gain: eq.mid })
  if (eq?.high != null) out.push({ type: 'biquad', kind: 'highshelf', f: EQ_HIGH_HZ, q: 1, gain: eq.high })
  if (fx.comp) {
    const c = fx.comp
    // Web Audio's knee starts AT the threshold; ffmpeg's is centred on it.
    const t = c.threshold - COMP_KNEE_DB / 2
    out.push({ type: 'comp', threshold: t, knee: COMP_KNEE_DB, ratio: c.ratio, attack: c.attack / 1000, release: c.release / 1000 })
    out.push({ type: 'gain', db: r2(c.makeup - webAutoMakeupDb(c.threshold, c.ratio)) })
  }
  const vfx = fx.vfx
  if (vfx) {
    const m = (vfx.amount ?? FX_LIMITS.vfxAmount[2]) / 100
    if (vfx.type === 'echo') out.push({ type: 'delays', dry: 1, taps: [{ s: 0.3, g: 0.6 * m }, { s: 0.6, g: 0.3 * m }] })
    else if (vfx.type === 'reverb') {
      const taps = [23, 37, 53, 71, 97, 131].map((ms, i) => ({ s: ms / 1000, g: m * 0.5 * 0.8 ** i }))
      out.push({ type: 'delays', dry: 1, taps })
    } else if (vfx.type === 'robot') out.push({ type: 'ring', hz: 60, m })
    else if (vfx.type === 'telephone') {
      out.push({ type: 'biquad', kind: 'highpass', f: 300, q: WEB_HP_Q_DB, gain: 0 })
      out.push({ type: 'biquad', kind: 'lowpass', f: 3400, q: WEB_HP_Q_DB, gain: 0 })
    }
  }
  if (stage === 'pre') return out
  if (fx.lufs != null && lufsGainDb != null && Number.isFinite(lufsGainDb)) out.push({ type: 'gain', db: r2(lufsGainDb) })
  if (fx.limit != null) {
    out.push({ type: 'comp', threshold: fx.limit, knee: 0, ratio: 20, attack: 0.003, release: 0.05 })
    out.push({ type: 'gain', db: r2(-webAutoMakeupDb(fx.limit, 20)) })
  }
  if (fx.track === 'voice' && fx.pan != null && fx.pan !== 0) {
    const [gl, gr] = panGains(fx.pan)
    out.push({ type: 'pan', gl, gr })
  }
  return out
}

/** Linear gain the LUFS target asks for (same clamp as the worker). */
export function lufsGainDb(measured: number | null, target: number | undefined): number | null {
  if (target == null || measured == null || !Number.isFinite(measured) || measured < -69) return null
  return r2(Math.max(-LUFS_GAIN_MAX_DB, Math.min(LUFS_GAIN_MAX_DB, target - measured)))
}

type Ctx = Pick<
  BaseAudioContext,
  'createBiquadFilter' | 'createDynamicsCompressor' | 'createGain' | 'createDelay' | 'createChannelSplitter' | 'createChannelMerger' | 'createOscillator'
>
/** Build the nodes in series. Returns input / output (same node when the plan is empty). */
export function buildFxChain(ctx: Ctx, plan: FxNode[]): { input: AudioNode; output: AudioNode; nodes: AudioNode[] } {
  const nodes: AudioNode[] = []
  let input: AudioNode | null = null
  let output: AudioNode | null = null
  const link = (n: AudioNode) => {
    if (!input) input = n
    if (output) output.connect(n)
    output = n
    nodes.push(n)
  }
  for (const n of plan) {
    if (n.type === 'biquad') {
      const b = ctx.createBiquadFilter()
      b.type = n.kind === 'lowpass' ? 'lowpass' : n.kind
      b.frequency.value = n.f
      b.Q.value = n.q
      b.gain.value = n.gain
      link(b)
    } else if (n.type === 'comp') {
      const c = ctx.createDynamicsCompressor()
      c.threshold.value = n.threshold
      c.knee.value = n.knee
      c.ratio.value = n.ratio
      c.attack.value = n.attack
      c.release.value = n.release
      link(c)
    } else if (n.type === 'gain') {
      const g = ctx.createGain()
      g.gain.value = Math.pow(10, n.db / 20)
      link(g)
    } else if (n.type === 'pan') {
      const split = ctx.createChannelSplitter(2)
      const merge = ctx.createChannelMerger(2)
      const gL = ctx.createGain()
      const gR = ctx.createGain()
      gL.gain.value = n.gl
      gR.gain.value = n.gr
      split.connect(gL, 0)
      split.connect(gR, 0)
      gL.connect(merge, 0, 0)
      gR.connect(merge, 0, 1)
      link(split)
      nodes.push(gL, gR, merge)
      output = merge
    } else if (n.type === 'delays') {
      const dry = ctx.createGain()
      dry.gain.value = n.dry
      const sum = ctx.createGain()
      sum.gain.value = 1
      link(dry)
      dry.connect(sum)
      for (const tap of n.taps) {
        const d = ctx.createDelay(2)
        d.delayTime.value = tap.s
        const g = ctx.createGain()
        g.gain.value = tap.g
        dry.connect(d)
        d.connect(g)
        g.connect(sum)
        nodes.push(d, g)
      }
      nodes.push(sum)
      output = sum
    } else if (n.type === 'ring') {
      const inG = ctx.createGain()
      inG.gain.value = 1
      link(inG)
      const dryG = ctx.createGain()
      dryG.gain.value = 1 - n.m
      const wetG = ctx.createGain()
      wetG.gain.value = 0
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = n.hz
      const mod = ctx.createGain()
      mod.gain.value = n.m
      osc.connect(mod)
      mod.connect(wetG.gain)
      osc.start()
      const sum = ctx.createGain()
      sum.gain.value = 1
      inG.connect(dryG)
      inG.connect(wetG)
      dryG.connect(sum)
      wetG.connect(sum)
      nodes.push(dryG, wetG, sum, osc, mod)
      output = sum
    }
  }
  if (!input || !output) {
    const g = ctx.createGain()
    return { input: g, output: g, nodes: [g] }
  }
  return { input, output, nodes }
}

export function fxPlanKey(fx: TrackFx | undefined, gain: number | null): string {
  return fx ? `${JSON.stringify(fx)}|${gain ?? ''}` : ''
}

// ---------------------------------------------------------------------------
// ITU-R BS.1770-4 integrated loudness (preview measurement; ffmpeg loudnorm on export)
// ---------------------------------------------------------------------------

type Biq = [number, number, number, number, number] // b0 b1 b2 a1 a2 (a0 = 1)
function kWeighting(fs: number): [Biq, Biq] {
  // Pre-filter (high shelf) + RLB high-pass, as designed for any sample rate (pyloudnorm).
  const shelf = (() => {
    const G = 4.0, Q = 1 / Math.sqrt(2), fc = 1500.0
    const A = Math.pow(10, G / 40), w0 = (2 * Math.PI * fc) / fs, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0)
    const b0 = A * (A + 1 + (A - 1) * c + 2 * Math.sqrt(A) * al)
    const b1 = -2 * A * (A - 1 + (A + 1) * c)
    const b2 = A * (A + 1 + (A - 1) * c - 2 * Math.sqrt(A) * al)
    const a0 = A + 1 - (A - 1) * c + 2 * Math.sqrt(A) * al
    const a1 = 2 * (A - 1 - (A + 1) * c)
    const a2 = A + 1 - (A - 1) * c - 2 * Math.sqrt(A) * al
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0] as Biq
  })()
  const hp = (() => {
    const Q = 0.5, fc = 38.0
    const w0 = (2 * Math.PI * fc) / fs, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0)
    const a0 = 1 + al
    return [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - al) / a0] as Biq
  })()
  return [shelf, hp]
}

function filt(x: Float32Array | number[], [b0, b1, b2, a1, a2]: Biq): Float64Array {
  const y = new Float64Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!
    const yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    y[i] = yi
    x2 = x1; x1 = xi; y2 = y1; y1 = yi
  }
  return y
}

/** Integrated loudness (LUFS) of 1–2 channels; null when everything is below the −70 LUFS gate. */
export function integratedLufs(channels: readonly (Float32Array | number[])[], fs: number): number | null {
  if (!channels.length || fs <= 0) return null
  const [k1, k2] = kWeighting(fs)
  const sq = channels.slice(0, 2).map((ch) => {
    const y = filt(filt(ch, k1) as unknown as number[], k2)
    for (let i = 0; i < y.length; i++) y[i] = y[i]! * y[i]!
    return y
  })
  const n = sq[0]!.length
  const block = Math.round(0.4 * fs)
  const hop = Math.round(0.1 * fs)
  if (n < block) return null
  const z: number[] = []
  // Prefix sums for O(n) block energies.
  const pre = sq.map((y) => {
    const p = new Float64Array(n + 1)
    for (let i = 0; i < n; i++) p[i + 1] = p[i]! + y[i]!
    return p
  })
  for (let s = 0; s + block <= n; s += hop) {
    let e = 0
    for (const p of pre) e += (p[s + block]! - p[s]!) / block
    z.push(e)
  }
  const L = (e: number) => -0.691 + 10 * Math.log10(e)
  const abs = z.filter((e) => e > 0 && L(e) > -70)
  if (!abs.length) return null
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const rel = L(mean(abs)) - 10
  const gated = abs.filter((e) => L(e) > rel)
  return gated.length ? Math.round(L(mean(gated)) * 100) / 100 : null
}
