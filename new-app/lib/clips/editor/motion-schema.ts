/**
 * E3 motion schema: keyframes + transitions (additive JSON inside clip.edits — no DB migration).
 * No imports, so lib/clips/edits.ts (and the worker mirror clips_worker/motion.py) can use it freely.
 *
 * Time bases (all ms):
 *  - target 'video' | 'voice' | 'text'  → OUTPUT ms (the E2 single time base; text = hook overlay, starts at 0)
 *  - target `broll:<id>`                 → item-local ms (0 = item start); content-anchored via inMs
 *  - target 'music'                      → local to the music window start (0 = window start)
 */

export type Ease = 'linear' | 'in' | 'out' | 'inOut'
export const EASES: readonly Ease[] = ['linear', 'in', 'out', 'inOut'] as const
export const EASE_LABELS: Record<Ease, string> = { linear: 'Linear', in: 'Ease in', out: 'Ease out', inOut: 'Ease in-out' }

export type KeyProp = 'x' | 'y' | 'scale' | 'rotation' | 'opacity' | 'volume'
export const KEY_PROPS: readonly KeyProp[] = ['x', 'y', 'scale', 'rotation', 'opacity', 'volume'] as const

export type KeyframeTarget = 'video' | 'voice' | 'music' | 'text' | `broll:${string}`

/** One keyframe. `ease` shapes the segment from this point to the next (After Effects "outgoing"). */
export type KeyPoint = { tMs: number; v: number; ease?: Ease }

/** Points empty ⇒ the static `value` (or the property default) applies for the whole item. */
export type KeyframeTrack = { target: KeyframeTarget; prop: KeyProp; value?: number; points: KeyPoint[] }

export type PropSpec = { label: string; unit: string; min: number; max: number; def: number; step: number }

/**
 * x / y: offset in % of the frame width / height. scale: %. rotation: degrees, clockwise.
 * opacity: %. volume: % gain (0–100: attenuation only, so the preview can match the export exactly).
 */
export const PROP_SPECS: Record<KeyProp, PropSpec> = {
  x: { label: 'Position X', unit: '%', min: -100, max: 100, def: 0, step: 1 },
  y: { label: 'Position Y', unit: '%', min: -100, max: 100, def: 0, step: 1 },
  scale: { label: 'Scale', unit: '%', min: 10, max: 400, def: 100, step: 1 },
  rotation: { label: 'Rotation', unit: '°', min: -360, max: 360, def: 0, step: 1 },
  opacity: { label: 'Opacity', unit: '%', min: 0, max: 100, def: 100, step: 1 },
  volume: { label: 'Volume', unit: '%', min: 0, max: 100, def: 100, step: 1 },
}

export type TransitionType =
  | 'crossfade'
  | 'dip_black'
  | 'dip_white'
  | 'push_left'
  | 'push_right'
  | 'push_up'
  | 'push_down'
  | 'wipe_left'
  | 'wipe_right'
  | 'wipe_up'
  | 'wipe_down'
  | 'zoom_in'
  | 'zoom_out'
  | 'blur'

export const TRANSITION_TYPES: readonly TransitionType[] = [
  'crossfade',
  'dip_black',
  'dip_white',
  'push_left',
  'push_right',
  'push_up',
  'push_down',
  'wipe_left',
  'wipe_right',
  'wipe_up',
  'wipe_down',
  'zoom_in',
  'zoom_out',
  'blur',
] as const

export type TransitionSpec = { type: TransitionType; durMs: number }
/** A transition on a Video-lane cut, keyed by the SOURCE ms where the following kept segment starts. */
export type CutTransition = TransitionSpec & { srcMs: number }

/** CapCut default 0.5 s, Descript 0.3 s — we default in between. */
export const TRANSITION_DEFAULT_MS = 400
export const TRANSITION_MIN_MS = 100
export const TRANSITION_MAX_MS = 2000
/** Export frame rate (worker renders transition windows at this rate; windows snap to its grid). */
export const MOTION_FPS = 30

function finite(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clampN(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function isTarget(t: unknown): t is KeyframeTarget {
  if (typeof t !== 'string') return false
  return t === 'video' || t === 'voice' || t === 'music' || t === 'text' || (t.startsWith('broll:') && t.length > 6)
}

/** Which properties a target can animate (CapCut: visual layers vs audio). */
export function propsForTarget(target: KeyframeTarget): readonly KeyProp[] {
  if (target === 'voice' || target === 'music') return ['volume']
  return ['x', 'y', 'scale', 'rotation', 'opacity']
}

export function normalizeTransitionSpec(raw: unknown): TransitionSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const type = o.type
  if (typeof type !== 'string' || !(TRANSITION_TYPES as readonly string[]).includes(type)) return undefined
  const d = finite(o.durMs) ?? TRANSITION_DEFAULT_MS
  return { type: type as TransitionType, durMs: Math.round(clampN(d, TRANSITION_MIN_MS, TRANSITION_MAX_MS)) }
}

export function normalizeKeyframeTracks(raw: unknown): KeyframeTrack[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: KeyframeTrack[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (!isTarget(o.target)) continue
    const prop = o.prop
    if (typeof prop !== 'string' || !(KEY_PROPS as readonly string[]).includes(prop)) continue
    if (!propsForTarget(o.target).includes(prop as KeyProp)) continue
    const key = `${o.target}|${prop}`
    if (seen.has(key)) continue
    const spec = PROP_SPECS[prop as KeyProp]
    const byT = new Map<number, KeyPoint>()
    for (const p of Array.isArray(o.points) ? o.points : []) {
      if (!p || typeof p !== 'object') continue
      const q = p as Record<string, unknown>
      const t = finite(q.tMs)
      const v = finite(q.v)
      if (t == null || v == null || t < -600000 || t > 36_000_000) continue
      const ease = typeof q.ease === 'string' && (EASES as readonly string[]).includes(q.ease) ? (q.ease as Ease) : undefined
      const tMs = Math.round(t)
      byT.set(tMs, { tMs, v: clampN(v, spec.min, spec.max), ...(ease && ease !== 'linear' ? { ease } : {}) })
    }
    const points = [...byT.values()].sort((a, b) => a.tMs - b.tMs)
    const sv = finite(o.value)
    const value = sv == null ? undefined : clampN(sv, spec.min, spec.max)
    if (!points.length && (value == null || value === spec.def)) continue
    seen.add(key)
    out.push({ target: o.target, prop: prop as KeyProp, ...(value != null ? { value } : {}), points })
  }
  return out.length ? out : undefined
}

export function normalizeCutTransitions(raw: unknown): CutTransition[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const byKey = new Map<number, CutTransition>()
  for (const r of raw) {
    const spec = normalizeTransitionSpec(r)
    const src = finite((r as Record<string, unknown> | null)?.srcMs)
    if (!spec || src == null || src < 0) continue
    byKey.set(Math.round(src), { srcMs: Math.round(src), ...spec })
  }
  const out = [...byKey.values()].sort((a, b) => a.srcMs - b.srcMs)
  return out.length ? out : undefined
}
