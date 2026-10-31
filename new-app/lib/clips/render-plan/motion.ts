/**
 * EP1: worker/clips_worker/motion.py keyframe math (normalize_keyframes + layer_transform_at +
 * has_motion) for the ASS builders. Re-normalises like the worker so raw edits give the worker's
 * bytes; the editor's lib/clips/editor/keyframes.ts is the same math on already-normalised edits.
 */
import { pyRound } from '@/lib/clips/render-plan/py'

type Dict = Record<string, unknown>
export type Pt = { tMs: number; v: number; ease?: string }
export type Track = { target: string; prop: string; value?: number; points: Pt[] }
export type Transform = { x: number; y: number; scale: number; rotation: number; opacity: number }

export const MOTION_FPS = 30
const PROP_SPECS: Record<string, [number, number, number]> = {
  x: [-100, 100, 0], y: [-100, 100, 0], scale: [10, 400, 100], rotation: [-360, 360, 0], opacity: [0, 100, 100], volume: [0, 100, 100],
}

function finite(v: unknown): number | null {
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const f = Number(v.trim())
    return Number.isFinite(f) ? f : null
  }
  return null
}

function validTarget(t: unknown): t is string {
  return typeof t === 'string' && (['video', 'voice', 'music', 'text'].includes(t) || (t.startsWith('broll:') && t.length > 6) || (t.startsWith('text:') && t.length > 5))
}

const propsFor = (target: string) => (target === 'voice' || target === 'music' ? ['volume'] : ['x', 'y', 'scale', 'rotation', 'opacity'])

export function normalizeKeyframes(raw: unknown): Track[] {
  const out: Track[] = []
  const seen = new Set<string>()
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue
    const { target, prop } = r as Dict
    if (!validTarget(target) || typeof prop !== 'string' || !(prop in PROP_SPECS) || !propsFor(target).includes(prop)) continue
    const key = `${target}|${prop}`
    if (seen.has(key)) continue
    const [lo, hi, d] = PROP_SPECS[prop]!
    const byT = new Map<number, Pt>()
    const pts0 = (r as Dict).points
    for (const p of Array.isArray(pts0) ? pts0 : []) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) continue
      const t = finite((p as Dict).tMs)
      const v = finite((p as Dict).v)
      if (t === null || v === null) continue
      const pt: Pt = { tMs: pyRound(t), v: Math.min(hi, Math.max(lo, v)) }
      const e = (p as Dict).ease
      if (e === 'in' || e === 'out' || e === 'inOut') pt.ease = e
      byT.set(pt.tMs, pt)
    }
    const pts = [...byT.keys()].sort((a, b) => a - b).map((k) => byT.get(k)!)
    let val = finite((r as Dict).value)
    val = val === null ? null : Math.min(hi, Math.max(lo, val))
    if (!pts.length && (val === null || val === d)) continue
    seen.add(key)
    out.push({ target, prop, ...(val !== null ? { value: val } : {}), points: pts })
  }
  return out
}

function easeValue(ease: string | undefined, u: number): number {
  const x = Math.min(1, Math.max(0, u))
  if (ease === 'in') return x * x
  if (ease === 'out') return x * (2 - x)
  if (ease === 'inOut') return x * x * (3 - 2 * x)
  return x
}

function valueAtPoints(points: Pt[], t: number, d: number): number {
  const n = points.length
  if (!n) return d
  if (t <= points[0]!.tMs) return points[0]!.v
  if (t >= points[n - 1]!.tMs) return points[n - 1]!.v
  for (let i = 0; i + 1 < n; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    if (t < b.tMs) {
      const span = b.tMs - a.tMs
      if (span <= 0) return b.v
      return a.v + (b.v - a.v) * easeValue(a.ease, (t - a.tMs) / span)
    }
  }
  return points[n - 1]!.v
}

export function layerTransformAtPy(tracks: Track[], target: string, localMs: number): Transform {
  const v = (prop: string): number => {
    const d = PROP_SPECS[prop]![2]
    const tr = tracks.find((k) => k.target === target && k.prop === prop)
    if (!tr) return d
    if (!tr.points.length) return tr.value === undefined ? d : tr.value
    return valueAtPoints(tr.points, localMs, d)
  }
  return { x: v('x'), y: v('y'), scale: v('scale'), rotation: v('rotation'), opacity: v('opacity') }
}

export function hasMotionPy(tracks: Track[], target: string): boolean {
  return tracks.some((k) => k.target === target && (k.points.length > 0 || (k.value !== undefined && k.value !== PROP_SPECS[k.prop]![2])))
}
