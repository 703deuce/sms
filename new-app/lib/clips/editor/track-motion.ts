/**
 * G1c track motion (Vegas "Track Motion"): one transform per overlay track — position, scale,
 * crop, keyframable in OUTPUT ms — applied to every item on the track. Mirror:
 * worker clips_worker/track_motion.py (parity fixture g1c2_parity.json).
 *
 * It is baked into each item's own `broll:<id>` keyframes by applyTrackRender, so the preview and
 * the export keep using the one per-item motion path that already matches (E3 / G1a):
 *   layer map: p → c + (x%·W, y%·H) + S·(p − c)  ⇒  track ∘ item:
 *   x' = xT + sT·xI / 100,  y' = yT + sT·yI / 100,  scale' = sT·sI / 100
 *   crop (track crop of the item's visible part): L' = LI + LT·(100 − LI − RI) / 100 (same for R / T / B)
 * Exact when at most one input of a property is animated (its points are mapped, eases kept);
 * otherwise sampled at the union of key times (+ 4 steps inside eased spans), linear between.
 * Item rotation is not composed (track motion has no rotation).
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { valueAtPoints } from '@/lib/clips/editor/keyframes'
import { CROP_MIN_VISIBLE, PROP_SPECS, type KeyframeTarget, type KeyframeTrack, type KeyPoint, type KeyProp } from '@/lib/clips/editor/motion-schema'
import { effectiveTracks, trackIdOf } from '@/lib/clips/editor/tracks'

export const TRACK_MOTION_PROPS = ['x', 'y', 'scale', 'cropL', 'cropT', 'cropR', 'cropB'] as const
export type TrackMotionProp = (typeof TRACK_MOTION_PROPS)[number]
export type TrackMotionKey = { prop: TrackMotionProp; value?: number; points: KeyPoint[] }
export type TrackMotion = { track: string; keys: TrackMotionKey[] }

const MAX_POINTS = 64
const KEY_RE = /^ov\d{1,3}$/
const r2 = (v: number) => Math.round(v * 100) / 100
const clampP = (p: KeyProp, v: number) => Math.min(PROP_SPECS[p].max, Math.max(PROP_SPECS[p].min, v))

export function normalizeTrackMotion(raw: unknown, trackIds?: ReadonlySet<string>): TrackMotion[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const by = new Map<string, TrackMotion>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const track = typeof o.track === 'string' && KEY_RE.test(o.track) ? o.track : null
    if (!track || (trackIds && !trackIds.has(track))) continue
    const keys: TrackMotionKey[] = []
    for (const k of Array.isArray(o.keys) ? o.keys : []) {
      if (!k || typeof k !== 'object') continue
      const kk = k as Record<string, unknown>
      const prop = TRACK_MOTION_PROPS.find((p) => p === kk.prop)
      if (!prop || keys.some((x) => x.prop === prop)) continue
      const byT = new Map<number, KeyPoint>()
      for (const p of Array.isArray(kk.points) ? kk.points : []) {
        if (!p || typeof p !== 'object') continue
        const pp = p as Record<string, unknown>
        const t = Number(pp.tMs)
        const v = Number(pp.v)
        if (!Number.isFinite(t) || !Number.isFinite(v) || t < 0) continue
        const pt: KeyPoint = { tMs: Math.round(t), v: r2(clampP(prop, v)) }
        if (pp.ease === 'in' || pp.ease === 'out' || pp.ease === 'inOut') pt.ease = pp.ease
        byT.set(pt.tMs, pt)
      }
      const points = [...byT.values()].sort((a, b) => a.tMs - b.tMs).slice(0, MAX_POINTS)
      const vRaw = Number(kk.value)
      const value = kk.value != null && Number.isFinite(vRaw) ? r2(clampP(prop, vRaw)) : undefined
      if (!points.length && (value == null || value === PROP_SPECS[prop].def)) continue
      keys.push({ prop, ...(value != null && !points.length ? { value } : {}), points })
    }
    if (keys.length) by.set(track, { track, keys: keys.sort((a, b) => TRACK_MOTION_PROPS.indexOf(a.prop) - TRACK_MOTION_PROPS.indexOf(b.prop)) })
  }
  const out = [...by.values()].sort((a, b) => (a.track < b.track ? -1 : a.track > b.track ? 1 : 0))
  return out.length ? out : undefined
}

export function trackMotionFor(edits: Pick<ClipEditsV2, 'trackMotion'>, track: string): TrackMotion | undefined {
  return edits.trackMotion?.find((m) => m.track === track)
}

/** Replace one track's motion (null / empty = remove). */
export function withTrackMotion(list: TrackMotion[] | undefined, track: string, keys: TrackMotionKey[] | null): TrackMotion[] | undefined {
  const rest = (list ?? []).filter((m) => m.track !== track)
  const n = keys ? normalizeTrackMotion([{ track, keys }]) : undefined
  const out = [...rest, ...(n ?? [])].sort((a, b) => (a.track < b.track ? -1 : a.track > b.track ? 1 : 0))
  return out.length ? out : undefined
}

/** Set a property: static (no points) or a keyframe at `atMs` (output ms) when animating. */
export function setTrackMotionValue(keys: readonly TrackMotionKey[], prop: TrackMotionProp, v: number, atMs: number | null): TrackMotionKey[] {
  const cur = keys.find((k) => k.prop === prop)
  const others = keys.filter((k) => k.prop !== prop)
  if (atMs == null || !cur?.points.length) {
    if (atMs != null) return [...others, { prop, points: [{ tMs: Math.round(atMs), v }] }]
    return [...others, { prop, value: v, points: [] }]
  }
  const pts = cur.points.filter((p) => Math.abs(p.tMs - atMs) > 15)
  pts.push({ tMs: Math.round(atMs), v })
  return [...others, { prop, points: pts.sort((a, b) => a.tMs - b.tMs) }]
}

// ---------------------------------------------------------------------------
// Presets (Vegas / Premiere split-screen + PiP)
// ---------------------------------------------------------------------------

export type MotionPreset =
  | 'full'
  | 'left_half'
  | 'right_half'
  | 'pip_tl'
  | 'pip_tr'
  | 'pip_bl'
  | 'pip_br'
  | 'left_third'
  | 'center_third'
  | 'right_third'

export const MOTION_PRESETS: { id: MotionPreset; label: string }[] = [
  { id: 'full', label: 'Full frame' },
  { id: 'left_half', label: '2-up left' },
  { id: 'right_half', label: '2-up right' },
  { id: 'pip_tl', label: 'PiP ↖' },
  { id: 'pip_tr', label: 'PiP ↗' },
  { id: 'pip_bl', label: 'PiP ↙' },
  { id: 'pip_br', label: 'PiP ↘' },
  { id: 'left_third', label: '3-up left' },
  { id: 'center_third', label: '3-up center' },
  { id: 'right_third', label: '3-up right' },
]

export const PIP_SCALE = 30
export const PIP_OFFSET = 32
const THIRD = 100 / 3

/** Static values of a preset (props at their default are omitted). */
export function presetValues(p: MotionPreset): Partial<Record<TrackMotionProp, number>> {
  switch (p) {
    case 'left_half':
      return { x: -25, cropL: 25, cropR: 25 }
    case 'right_half':
      return { x: 25, cropL: 25, cropR: 25 }
    case 'pip_tl':
      return { x: -PIP_OFFSET, y: -PIP_OFFSET, scale: PIP_SCALE }
    case 'pip_tr':
      return { x: PIP_OFFSET, y: -PIP_OFFSET, scale: PIP_SCALE }
    case 'pip_bl':
      return { x: -PIP_OFFSET, y: PIP_OFFSET, scale: PIP_SCALE }
    case 'pip_br':
      return { x: PIP_OFFSET, y: PIP_OFFSET, scale: PIP_SCALE }
    case 'left_third':
      return { x: r2(-THIRD), cropL: r2(THIRD), cropR: r2(THIRD) }
    case 'center_third':
      return { cropL: r2(THIRD), cropR: r2(THIRD) }
    case 'right_third':
      return { x: r2(THIRD), cropL: r2(THIRD), cropR: r2(THIRD) }
    default:
      return {}
  }
}

export function presetKeys(p: MotionPreset): TrackMotionKey[] {
  return Object.entries(presetValues(p)).map(([prop, value]) => ({ prop: prop as TrackMotionProp, value, points: [] }))
}

/** The main picture's slot for a split preset: static `video` keyframe values (x / crops). */
export function applyMainPreset(edits: ClipEditsV2, p: MotionPreset): ClipEditsV2 {
  const vals = presetValues(p)
  const props: KeyProp[] = ['x', 'y', 'scale', 'cropL', 'cropT', 'cropR', 'cropB']
  const rest = (edits.keyframes ?? []).filter((k) => k.target !== 'video' || !props.includes(k.prop))
  const add: KeyframeTrack[] = props
    .filter((q) => vals[q as TrackMotionProp] != null && vals[q as TrackMotionProp] !== PROP_SPECS[q].def)
    .map((q) => ({ target: 'video', prop: q, value: vals[q as TrackMotionProp]!, points: [] }))
  const keyframes = [...rest, ...add]
  return { ...edits, keyframes: keyframes.length ? keyframes : undefined }
}

// ---------------------------------------------------------------------------
// Bake into per-item keyframes (render-time; preview + export)
// ---------------------------------------------------------------------------

type Src = { def: number; value?: number; points: KeyPoint[] } // points in item-local ms

const animated = (s: Src) => s.points.length > 0
const valAt = (s: Src, t: number) => (s.points.length ? valueAtPoints(s.points, t, s.def) : (s.value ?? s.def))

/** The points of `pts` that matter inside [0, dur] (plus the nearest one outside on each side). */
function windowPoints(pts: readonly KeyPoint[], dur: number): KeyPoint[] {
  let lo = 0
  let hi = pts.length - 1
  for (let i = 0; i < pts.length; i++) if (pts[i]!.tMs <= 0) lo = i
  for (let i = pts.length - 1; i >= 0; i--) if (pts[i]!.tMs >= dur) hi = i
  return pts.slice(lo, hi + 1)
}

function composeTrack(
  prop: KeyProp,
  srcs: Src[],
  f: (vals: number[]) => number,
  dur: number,
): { value?: number; points: KeyPoint[] } | null {
  const anim = srcs.map(animated)
  const nAnim = anim.filter(Boolean).length
  const fix = (v: number) => r2(clampP(prop, v))
  if (!nAnim) {
    const v = fix(f(srcs.map((s) => valAt(s, 0))))
    return v === PROP_SPECS[prop].def ? null : { value: v, points: [] }
  }
  const settle = (points: KeyPoint[]) => (points.every((p) => p.v === PROP_SPECS[prop].def) ? null : { points })
  if (nAnim === 1) {
    const k = anim.indexOf(true)
    const pts = windowPoints(srcs[k]!.points, dur)
    return settle(
      pts.map((p) => {
        const vals = srcs.map((s, j) => (j === k ? p.v : valAt(s, p.tMs)))
        return { tMs: p.tMs, v: fix(f(vals)), ...(p.ease ? { ease: p.ease } : {}) }
      }),
    )
  }
  const times = new Set<number>([0, dur])
  for (const s of srcs) {
    const pts = s.points
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!
      if (p.tMs > 0 && p.tMs < dur) times.add(p.tMs)
      const q = pts[i + 1]
      if (p.ease && q) for (let j = 1; j < 4; j++) {
        const t = Math.round(p.tMs + ((q.tMs - p.tMs) * j) / 4)
        if (t > 0 && t < dur) times.add(t)
      }
    }
  }
  let ts = [...times].sort((a, b) => a - b)
  if (ts.length > MAX_POINTS) {
    const step = (ts.length - 1) / (MAX_POINTS - 1)
    ts = Array.from({ length: MAX_POINTS }, (_, i) => ts[Math.round(i * step)]!)
  }
  return settle(ts.map((t) => ({ tMs: t, v: fix(f(srcs.map((s) => valAt(s, t)))) })))
}

export function applyTrackMotion(edits: ClipEditsV2): ClipEditsV2 {
  const ms = edits.trackMotion ?? []
  if (!ms.length) return edits
  // Baked once: the result carries no trackMotion, so a second derivation pass is a no-op.
  if (!edits.broll?.length) return { ...edits, trackMotion: undefined }
  const tracks = effectiveTracks(edits)
  const byTrack = new Map(ms.map((m) => [m.track, m]))
  let kf = [...(edits.keyframes ?? [])]
  let changed = false
  for (const b of edits.broll) {
    const m = byTrack.get(trackIdOf(edits, 'overlay', b.id, tracks))
    if (!m) continue
    const dur = b.endMs - b.startMs
    const target = `broll:${b.id}` as KeyframeTarget
    const item = (p: KeyProp): Src => {
      const k = kf.find((x) => x.target === target && x.prop === p)
      return { def: PROP_SPECS[p].def, ...(k?.value != null ? { value: k.value } : {}), points: k?.points ?? [] }
    }
    const trk = (p: TrackMotionProp): Src => {
      const k = m.keys.find((x) => x.prop === p)
      return {
        def: PROP_SPECS[p].def,
        ...(k?.value != null ? { value: k.value } : {}),
        points: (k?.points ?? []).map((pt) => ({ ...pt, tMs: pt.tMs - b.startMs })),
      }
    }
    const out: Partial<Record<KeyProp, { value?: number; points: KeyPoint[] } | null>> = {}
    out.x = composeTrack('x', [trk('x'), trk('scale'), item('x')], ([t, s, i]) => t! + (s! * i!) / 100, dur)
    out.y = composeTrack('y', [trk('y'), trk('scale'), item('y')], ([t, s, i]) => t! + (s! * i!) / 100, dur)
    out.scale = composeTrack('scale', [trk('scale'), item('scale')], ([s, i]) => (s! * i!) / 100, dur)
    const crop = (own: KeyProp, a: KeyProp, b2: KeyProp, tp: TrackMotionProp) =>
      composeTrack(own, [trk(tp), item(own), item(a), item(b2)], ([t, o, x, y]) => o! + (t! * (100 - x! - y!)) / 100, dur)
    out.cropL = crop('cropL', 'cropL', 'cropR', 'cropL')
    out.cropR = crop('cropR', 'cropL', 'cropR', 'cropR')
    out.cropT = crop('cropT', 'cropT', 'cropB', 'cropT')
    out.cropB = crop('cropB', 'cropT', 'cropB', 'cropB')
    // Keep ≥ CROP_MIN_VISIBLE of the layer per axis (static values only; animated crops are clamped by the renderer).
    for (const [a, z] of [['cropL', 'cropR'], ['cropT', 'cropB']] as const) {
      const A = out[a]
      const Z = out[z]
      if (A && Z && !A.points.length && !Z.points.length && (A.value ?? 0) + (Z.value ?? 0) > 100 - CROP_MIN_VISIBLE) {
        const k = (100 - CROP_MIN_VISIBLE) / ((A.value ?? 0) + (Z.value ?? 0))
        A.value = r2((A.value ?? 0) * k)
        Z.value = r2((Z.value ?? 0) * k)
      }
    }
    const props = Object.keys(out) as KeyProp[]
    kf = kf.filter((x) => x.target !== target || !props.includes(x.prop))
    for (const p of props) {
      const r = out[p]
      if (r) kf.push({ target, prop: p, ...(r.value != null ? { value: r.value } : {}), points: r.points })
    }
    changed = true
  }
  return changed ? { ...edits, keyframes: kf.length ? kf : undefined, trackMotion: undefined } : { ...edits, trackMotion: undefined }
}
