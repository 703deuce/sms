/**
 * E3 motion schema: keyframes + transitions (additive JSON inside clip.edits — no DB migration).
 * No imports, so lib/clips/edits.ts (and the worker mirror clips_worker/motion.py) can use it freely.
 *
 * Time bases (all ms):
 *  - target 'video' | 'voice' | 'text'  → OUTPUT ms (the E2 single time base; text = hook overlay, starts at 0)
 *  - target `broll:<id>`                 → item-local ms (0 = item start); content-anchored via inMs
 *  - target 'music'                      → local to the music window start (0 = window start)
 *  - target `text:<id>` (E4 text item)  → item-local ms (0 = item start)
 *  - target 'captions' (KF-12)           → OUTPUT ms (burned caption transform)
 */

export type Ease = 'linear' | 'in' | 'out' | 'inOut'
export const EASES: readonly Ease[] = ['linear', 'in', 'out', 'inOut'] as const
export const EASE_LABELS: Record<Ease, string> = { linear: 'Linear', in: 'Ease in', out: 'Ease out', inOut: 'Ease in-out' }

/** KF-15: the 4 presets as bezier heights (exact: y = u(c1 + u(c2 + u c3))). */
export const EASE_BZ: Record<Ease, [number, number]> = { linear: [1 / 3, 2 / 3], in: [0, 1 / 3], out: [2 / 3, 1], inOut: [0, 1] }
/** Clamp/round a raw bz; null when invalid. Returns { ease } when it equals a preset (to 0.01). */
export function normalizeBz(raw: unknown): { bz?: [number, number]; ease?: Ease } | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null
  const [a, b] = raw.map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0, n)) * 100) / 100 : NaN))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  for (const e of EASES) {
    const [pa, pb] = EASE_BZ[e]
    if (Math.abs(pa - a) < 0.006 && Math.abs(pb - b) < 0.006) return e === 'linear' ? {} : { ease: e }
  }
  return { bz: [a, b] }
}

/** KF-12: caption block offset / scale (output ms), applied as ASS \\pos + \\fscx/\\fscy. */
export const CAPTION_PROPS = ['capX', 'capY', 'capScale'] as const
export type CaptionKeyProp = (typeof CAPTION_PROPS)[number]

export type KeyProp =
  | 'x'
  | 'y'
  | 'scale'
  | 'rotation'
  | 'opacity'
  | 'volume'
  | 'cropL'
  | 'cropT'
  | 'cropR'
  | 'cropB'
  | CaptionKeyProp
  | ColorKeyProp
/**
 * G4a: keyframable color (Adjust sliders) on picture layers — video, B-roll, adjustment layers.
 * Same names in clips_worker/motion.py + color_grade.COLOR_KEY_PROPS. Never part of the motion
 * chain (hasMotion ignores them); the color pass reads them, quantized to COLOR_STEP_MS.
 */
export const COLOR_PROPS = [
  'cExposure',
  'cBrightness',
  'cContrast',
  'cSaturation',
  'cTemperature',
  'cTint',
  'cHighlights',
  'cShadows',
  'cVibrance',
  // G4c: keyframable effect amounts (spec.fx, 0..100), quantized to FX_KEY_QUANT by the color pass.
  'fxSharpen',
  'fxVignette',
  'fxGrain',
  'fxBlur',
  'fxGlow',
  'fxRgbsplit',
  'fxGlitch',
  'fxShake',
  'fxFlicker',
  'fxScanlines',
] as const
export type ColorKeyProp = (typeof COLOR_PROPS)[number]
export const ADJUST_KEY_PROPS = COLOR_PROPS.slice(0, 9) as readonly ColorKeyProp[]
export const FX_PROPS = COLOR_PROPS.slice(9) as readonly ColorKeyProp[]
export function isFxProp(p: string): boolean {
  return p.startsWith('fx') && (COLOR_PROPS as readonly string[]).includes(p)
}
export function isColorProp(p: string): p is ColorKeyProp {
  return (COLOR_PROPS as readonly string[]).includes(p)
}
export const KEY_PROPS: readonly KeyProp[] = [
  'x',
  'y',
  'scale',
  'rotation',
  'opacity',
  'volume',
  'cropL',
  'cropT',
  'cropR',
  'cropB',
  ...CAPTION_PROPS,
  ...COLOR_PROPS,
] as const
/** G1a: crop edges (% of the layer, measured in the un-flipped media) — video + B-roll layers only. */
export const CROP_PROPS = ['cropL', 'cropT', 'cropR', 'cropB'] as const
export type CropProp = (typeof CROP_PROPS)[number]

export type KeyframeTarget =
  | 'video'
  | 'voice'
  | 'music'
  | 'text'
  | 'captions'
  | `broll:${string}`
  | `text:${string}`
  | `sfx:${string}`
  | `adjust:${string}`

/** One keyframe. `ease` shapes the segment from this point to the next (After Effects "outgoing").
 *  KF-15 `bz` = custom curve heights [a, b] (x-handles fixed at 1/3, 2/3); wins over `ease`. */
export type KeyPoint = { tMs: number; v: number; ease?: Ease; bz?: [number, number] }

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
  cropL: { label: 'Crop left', unit: '%', min: 0, max: 90, def: 0, step: 1 },
  cropT: { label: 'Crop top', unit: '%', min: 0, max: 90, def: 0, step: 1 },
  cropR: { label: 'Crop right', unit: '%', min: 0, max: 90, def: 0, step: 1 },
  cropB: { label: 'Crop bottom', unit: '%', min: 0, max: 90, def: 0, step: 1 },
  capX: { label: 'Caption X', unit: '%', min: -50, max: 50, def: 0, step: 0.5 },
  capY: { label: 'Caption Y', unit: '%', min: -50, max: 50, def: 0, step: 0.5 },
  capScale: { label: 'Caption scale', unit: '%', min: 50, max: 200, def: 100, step: 1 },
  cExposure: { label: 'Exposure', unit: '', min: -100, max: 100, def: 0, step: 1 },
  cBrightness: { label: 'Brightness', unit: '', min: -100, max: 100, def: 0, step: 1 },
  cContrast: { label: 'Contrast', unit: '', min: -100, max: 100, def: 0, step: 1 },
  cSaturation: { label: 'Saturation', unit: '', min: -100, max: 100, def: 0, step: 1 },
  cTemperature: { label: 'Temperature', unit: '', min: -100, max: 100, def: 0, step: 1 },
  cTint: { label: 'Tint', unit: '', min: -100, max: 100, def: 0, step: 1 },
  cHighlights: { label: 'Highlights', unit: '', min: -100, max: 100, def: 0, step: 1 },
  cShadows: { label: 'Shadows', unit: '', min: -100, max: 100, def: 0, step: 1 },
  cVibrance: { label: 'Vibrance', unit: '', min: -100, max: 100, def: 0, step: 1 },
  fxSharpen: { label: 'Sharpen', unit: '', min: 0, max: 100, def: 0, step: 1 },
  fxVignette: { label: 'Vignette', unit: '', min: 0, max: 100, def: 0, step: 1 },
  fxGrain: { label: 'Grain', unit: '', min: 0, max: 100, def: 0, step: 1 },
  fxBlur: { label: 'Blur', unit: '', min: 0, max: 100, def: 0, step: 1 },
  fxGlow: { label: 'Glow', unit: '', min: 0, max: 100, def: 0, step: 1 },
  fxRgbsplit: { label: 'RGB split', unit: '', min: 0, max: 100, def: 0, step: 1 },
  fxGlitch: { label: 'Glitch', unit: '', min: 0, max: 100, def: 0, step: 1 },
  fxShake: { label: 'Shake', unit: '', min: 0, max: 100, def: 0, step: 1 },
  fxFlicker: { label: 'Flicker', unit: '', min: 0, max: 100, def: 0, step: 1 },
  fxScanlines: { label: 'Scanlines', unit: '', min: 0, max: 100, def: 0, step: 1 },
}

/** G1a: at least this much of the layer stays visible per axis (L + R and T + B are clamped). */
export const CROP_MIN_VISIBLE = 5

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
  // G4b: more xfade 5.1 transitions (per-pixel masks).
  | 'smooth_left'
  | 'smooth_right'
  | 'smooth_up'
  | 'smooth_down'
  | 'circle_open'
  | 'circle_close'
  | 'vert_open'
  | 'vert_close'
  | 'horz_open'
  | 'horz_close'
  | 'radial'
  | 'diag_tl'
  | 'diag_tr'
  | 'diag_bl'
  | 'diag_br'
  | 'slice_left'
  | 'slice_right'
  | 'slice_up'
  | 'slice_down'
  | 'wipe_tl'
  | 'wipe_tr'
  | 'wipe_bl'
  | 'wipe_br'

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
  'smooth_left',
  'smooth_right',
  'smooth_up',
  'smooth_down',
  'circle_open',
  'circle_close',
  'vert_open',
  'vert_close',
  'horz_open',
  'horz_close',
  'radial',
  'diag_tl',
  'diag_tr',
  'diag_bl',
  'diag_br',
  'slice_left',
  'slice_right',
  'slice_up',
  'slice_down',
  'wipe_tl',
  'wipe_tr',
  'wipe_bl',
  'wipe_br',
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
  return t === 'video' || t === 'voice' || t === 'music' || t === 'text' || t === 'captions' || (t.startsWith('broll:') && t.length > 6) || (t.startsWith('text:') && t.length > 5) || isSfxTarget(t) || isAdjustTarget(t)
}

/** G4a: adjustment layer (`adjust:<id>`, local ms from the layer start) — color props only. */
export function isAdjustTarget(t: string): boolean {
  return t.startsWith('adjust:') && t.length > 7
}

/** G4a: which color props a target can keyframe (picture layers + adjustment layers). */
export function colorPropsForTarget(target: KeyframeTarget): readonly ColorKeyProp[] {
  return isMediaLayerTarget(target) || isAdjustTarget(target) ? COLOR_PROPS : []
}

/** G1b3: per-SFX volume envelope (`sfx:<generationId>`, local ms from the SFX start). */
export function isSfxTarget(t: string): boolean {
  return t.startsWith('sfx:') && t.length > 4
}

/** Which properties a target can animate (CapCut: visual layers vs audio). */
export function propsForTarget(target: KeyframeTarget): readonly KeyProp[] {
  if (target === 'captions') return [...CAPTION_PROPS]
  if (target === 'voice' || target === 'music' || isSfxTarget(target)) return ['volume']
  if (isAdjustTarget(target)) return []
  if (isMediaLayerTarget(target)) return ['x', 'y', 'scale', 'rotation', 'opacity', ...CROP_PROPS]
  return ['x', 'y', 'scale', 'rotation', 'opacity']
}

/** G1a: picture layers (main video, B-roll) — crop + flip apply to these, not to text. */
export function isMediaLayerTarget(target: string): boolean {
  return target === 'video' || (target.startsWith('broll:') && target.length > 6)
}

// ---------------------------------------------------------------------------
// G1a layer properties: flip (static) + stacking order (z) — additive edits.layerProps
// ---------------------------------------------------------------------------

/**
 * One row per layer. flipH / flipV: media layers only (mirror after the crop, before scale /
 * rotate). z: stacking order among layers of the same kind that overlap in time (B-roll among
 * B-roll, text items among text items); default 0; higher = in front.
 */
/** Layers overlapping by less than one 30 fps frame (B-roll 'between' adjacency) do not stack. */
export const STACK_OVERLAP_TOL_MS = 34

export type LayerProp = { target: KeyframeTarget; flipH?: true; flipV?: true; z?: number }

export function normalizeLayerProps(raw: unknown): LayerProp[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const byT = new Map<string, LayerProp>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (!isTarget(o.target)) continue
    const target = o.target
    const media = isMediaLayerTarget(target)
    const zable = (target.startsWith('broll:') && target.length > 6) || (target.startsWith('text:') && target.length > 5)
    const row: LayerProp = { target }
    if (media && o.flipH === true) row.flipH = true
    if (media && o.flipV === true) row.flipV = true
    const z = finite(o.z)
    if (zable && z != null && Math.round(z) !== 0) row.z = Math.round(clampN(z, -1000, 1000))
    if (row.flipH || row.flipV || row.z != null) byT.set(target, row)
  }
  const out = [...byT.values()].sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : 0))
  return out.length ? out : undefined
}

/**
 * Stacking order (bottom → top) of time-ranged layers of one kind. Mirrored by
 * clips_worker/motion.py stack_order. Items are grouped into clusters of time-overlapping items
 * (strict overlap); clusters keep time order (so adjacent items and their 'between' transitions are
 * untouched), inside a cluster the order is (z, startMs, original index).
 */
export function stackOrder<T extends { id: string; startMs: number; endMs: number }>(
  items: readonly T[],
  zOf: (id: string) => number,
): T[] {
  const idx = items.map((it, i) => ({ it, i })).sort((a, b) => a.it.startMs - b.it.startMs || a.i - b.i)
  const out: T[] = []
  let cluster: { it: T; i: number }[] = []
  let clusterEnd = -Infinity
  const flush = () => {
    cluster.sort((a, b) => zOf(a.it.id) - zOf(b.it.id) || a.it.startMs - b.it.startMs || a.i - b.i)
    for (const c of cluster) out.push(c.it)
    cluster = []
  }
  for (const c of idx) {
    if (cluster.length && c.it.startMs >= clusterEnd - STACK_OVERLAP_TOL_MS) {
      flush()
      clusterEnd = -Infinity
    }
    cluster.push(c)
    clusterEnd = Math.max(clusterEnd, c.it.endMs)
  }
  flush()
  return out
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
    if (!propsForTarget(o.target).includes(prop as KeyProp) && !colorPropsForTarget(o.target).includes(prop as ColorKeyProp)) continue
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
      const nb = normalizeBz(q.bz)
      const shape = nb ?? (ease && ease !== 'linear' ? { ease } : {})
      byT.set(tMs, { tMs, v: clampN(v, spec.min, spec.max), ...shape })
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
