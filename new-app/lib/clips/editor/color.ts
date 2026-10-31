/**
 * E4 color: basic Adjust + preset Filters per item. One shared math model for preview and export:
 *
 *   rgb' = curve_c( clamp01( M · rgb + o ) )        (sRGB-encoded values in 0..1, per channel c)
 *
 * M (3×3) + o (3) is an affine matrix composed from the Adjust sliders + the preset; `curve_c` is a
 * per-channel piecewise-linear table with CURVE_N + 1 evenly spaced points (SVG feFuncX type=table).
 * Intensity (0..100) lerps M, o and the tables toward identity.
 *
 * Preview: inline SVG filter (feColorMatrix → feComponentTransfer, color-interpolation-filters=sRGB)
 * referenced by CSS `filter: url(#…)`. Export (worker clips_worker/color.py, a line-for-line mirror):
 * the same function sampled into a 33³ .cube applied with ffmpeg `lut3d` (ffmpeg 5.1 has lut3d with
 * timeline `enable`). Parity: tests/fixtures/e4-parity.json is checked by vitest AND worker pytest.
 *
 * G4a: a spec may also carry the color-grade v2 fields (exposure / highlights / shadows, curves,
 * lift-gamma-gain wheels, HSL ranges, a user LUT, sharpen / vignette / grain) — math in
 * color-grade.ts (mirror: clips_worker/color_grade.py). E4-only specs keep their exact E4 output.
 *
 * Only imports color-grade.ts (itself import-free), so lib/clips/edits.ts can use it.
 */
import {
  canonGrade,
  fnv1a,
  GRID,
  hasGradeFields,
  hasPointwiseV2,
  needs3d,
  normalizeGradeFields,
  postTables,
  preTable,
  stage3d,
  tableAt,
  V2_ADJUST,
  type CubeLut,
  type GradeFields,
  type Rgb,
} from '@/lib/clips/editor/color-grade'

export type ColorAdjust = {
  brightness: number
  contrast: number
  saturation: number
  temperature: number
  tint: number
  vibrance: number
  /** G4a (tables, see color-grade.ts) */
  exposure: number
  highlights: number
  shadows: number
}
export type ColorAdjustKey = keyof ColorAdjust
/** E4 affine sliders (the matrix). */
export const ADJUST_KEYS = ['brightness', 'contrast', 'saturation', 'temperature', 'tint', 'vibrance'] as const
/** Every Adjust slider, panel order (G4a adds exposure / highlights / shadows). */
export const ADJUST_KEYS_ALL: readonly ColorAdjustKey[] = [
  'exposure',
  'brightness',
  'contrast',
  'highlights',
  'shadows',
  'saturation',
  'vibrance',
  'temperature',
  'tint',
] as const
export const ADJUST_LABELS: Record<ColorAdjustKey, string> = {
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  temperature: 'Temperature',
  tint: 'Tint',
  vibrance: 'Vibrance',
  exposure: 'Exposure',
  highlights: 'Highlights',
  shadows: 'Shadows',
}
/** Every slider is −100..100, default 0 (CapCut Adjust). */
export const ADJUST_MIN = -100
export const ADJUST_MAX = 100

export type ColorPresetId =
  | 'vivid'
  | 'warm'
  | 'cool'
  | 'bw'
  | 'film'
  | 'fade'
  | 'teal_orange'
  | 'noir'
  | 'vintage'

/** A look applied to one target. All fields optional; {} = identity. */
export type ColorSpec = { preset?: ColorPresetId; intensity?: number; adjust?: Partial<ColorAdjust> } & GradeFields

/** Source-anchored per-clip override: applies to source ms [fromMs, toMs) of the main video. */
export type SegmentLook = { fromMs: number; toMs: number; spec: ColorSpec }

export type ClipColorEdits = {
  /** Whole main video ("Apply to all"). */
  video?: ColorSpec
  /** Per Video-lane item, keyed by its source range (survives ripple / reorder / silence trim). */
  segments?: SegmentLook[]
  /** Per B-roll item id. */
  broll?: Record<string, ColorSpec>
}

export const CURVE_N = 4 // 5 table points: 0, .25, .5, .75, 1
type Curve3 = [number[], number[], number[]]
type Mat3 = [number, number, number, number, number, number, number, number, number]

type PresetDef = { label: string; adjust?: Partial<ColorAdjust>; matrix?: Mat3; curve?: Curve3 }

const IDT: number[] = [0, 0.25, 0.5, 0.75, 1]

export const COLOR_PRESETS: Record<ColorPresetId, PresetDef> = {
  vivid: { label: 'Vivid', adjust: { saturation: 35, contrast: 12, vibrance: 20 } },
  warm: { label: 'Warm', adjust: { temperature: 45, saturation: 8, brightness: 3 } },
  cool: { label: 'Cool', adjust: { temperature: -45, tint: 5 } },
  bw: { label: 'B&W', adjust: { saturation: -100, contrast: 15 } },
  film: {
    label: 'Film',
    adjust: { saturation: -10, temperature: 10 },
    curve: [
      [0.06, 0.22, 0.5, 0.78, 0.95],
      [0.06, 0.22, 0.5, 0.78, 0.95],
      [0.06, 0.22, 0.5, 0.78, 0.95],
    ],
  },
  fade: { label: 'Fade', adjust: { contrast: -25, brightness: 6, saturation: -20 } },
  teal_orange: {
    label: 'Teal & Orange',
    adjust: { saturation: 10, contrast: 8 },
    curve: [
      [0, 0.22, 0.52, 0.8, 1],
      [0.02, 0.25, 0.5, 0.75, 0.98],
      [0.08, 0.3, 0.5, 0.7, 0.92],
    ],
  },
  noir: {
    label: 'Noir',
    adjust: { saturation: -100, contrast: 40 },
    curve: [
      [0, 0.18, 0.5, 0.8, 1],
      [0, 0.18, 0.5, 0.8, 1],
      [0, 0.18, 0.5, 0.8, 1],
    ],
  },
  vintage: {
    label: 'Vintage',
    // W3C sepia matrix (CSS sepia(1)), then faded.
    matrix: [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131],
    adjust: { contrast: -15, brightness: 4 },
  },
}
export const COLOR_PRESET_IDS = Object.keys(COLOR_PRESETS) as ColorPresetId[]

/** Rec.709 luma weights (saturation pivots on luma). */
const LR = 0.2126
const LG = 0.7152
const LB = 0.0722

export type ColorLook = { m: Mat3; o: [number, number, number]; curve: Curve3 | null }

const I3: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

function mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0) as number[]
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0
      for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j]
      r[i * 3 + j] = s
    }
  return r as Mat3
}
function mulV(a: Mat3, v: [number, number, number]): [number, number, number] {
  return [
    a[0] * v[0] + a[1] * v[1] + a[2] * v[2],
    a[3] * v[0] + a[4] * v[1] + a[5] * v[2],
    a[6] * v[0] + a[7] * v[1] + a[8] * v[2],
  ]
}
function satMat(s: number, wr = LR, wg = LG, wb = LB): Mat3 {
  const t = 1 - s
  return [
    t * wr + s, t * wg, t * wb,
    t * wr, t * wg + s, t * wb,
    t * wr, t * wg, t * wb + s,
  ]
}
function clampN(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Affine look of the Adjust sliders. Order: temperature/tint gains → saturation → vibrance → contrast → brightness. */
function adjustAffine(a: Partial<ColorAdjust>): { m: Mat3; o: [number, number, number] } {
  const g = (k: (typeof ADJUST_KEYS)[number]) => clampN(Number(a[k] ?? 0) || 0, ADJUST_MIN, ADJUST_MAX) / 100
  const temp = g('temperature') * 0.12
  const tint = g('tint') * 0.08
  // White-balance gains (warm: +R −B; tint +: magenta = −G).
  let m: Mat3 = [1 + temp + tint / 2, 0, 0, 0, 1 - tint, 0, 0, 0, 1 - temp + tint / 2]
  let o: [number, number, number] = [0, 0, 0]
  m = mul(satMat(1 + g('saturation')), m)
  // Vibrance-lite: a gentler saturation pivoting on a green-heavy luma, so skin (red) moves less.
  m = mul(satMat(1 + 0.6 * g('vibrance'), 0.3, 0.6, 0.1), m)
  const c = 1 + g('contrast')
  m = m.map((x) => x * c) as Mat3
  const co = 0.5 * (1 - c)
  const b = g('brightness') * 0.25
  o = [co + b, co + b, co + b]
  return { m, o }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function isIdentitySpec(spec: ColorSpec | undefined | null): boolean {
  if (!spec) return true
  const hasAdj = ADJUST_KEYS.some((k) => Number(spec.adjust?.[k] ?? 0) !== 0)
  return !hasAdj && (!spec.preset || (spec.intensity ?? 100) <= 0) && !hasGradeFields(spec)
}

/** Compose preset (at intensity) then the user's Adjust on top. */
export function lookForSpec(spec: ColorSpec | undefined | null): ColorLook {
  let m: Mat3 = I3
  let o: [number, number, number] = [0, 0, 0]
  let curve: Curve3 | null = null
  const p = spec?.preset ? COLOR_PRESETS[spec.preset] : undefined
  if (p) {
    const t = clampN(Number(spec?.intensity ?? 100), 0, 100) / 100
    let pm: Mat3 = p.matrix ?? I3
    let po: [number, number, number] = [0, 0, 0]
    if (p.adjust) {
      const a = adjustAffine(p.adjust)
      pm = mul(a.m, pm)
      po = a.o
    }
    m = I3.map((x, i) => lerp(x, pm[i], t)) as Mat3
    o = [lerp(0, po[0], t), lerp(0, po[1], t), lerp(0, po[2], t)]
    if (p.curve) curve = p.curve.map((tab) => tab.map((v, i) => lerp(IDT[i], v, t))) as Curve3
  }
  if (spec?.adjust) {
    // User adjust applies AFTER the preset matrix (curves stay last).
    const a = adjustAffine(spec.adjust)
    o = mulV(a.m, o).map((v, i) => v + a.o[i]) as [number, number, number]
    m = mul(a.m, m)
  }
  return { m, o, curve }
}

function curveAt(tab: number[], x: number): number {
  const f = clampN(x, 0, 1) * CURVE_N
  const k = Math.min(CURVE_N - 1, Math.floor(f))
  return tab[k] + (f - k) * (tab[k + 1] - tab[k])
}

/** Apply a look to one sRGB pixel (0..1). Mirrors clips_worker/color.py apply_look. */
export function applyLook(look: ColorLook, rgb: [number, number, number]): [number, number, number] {
  const v = mulV(look.m, rgb).map((x, i) => clampN(x + look.o[i], 0, 1)) as [number, number, number]
  if (!look.curve) return v
  return [curveAt(look.curve[0], v[0]), curveAt(look.curve[1], v[1]), curveAt(look.curve[2], v[2])]
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6

/** feColorMatrix `values` (4×5, alpha passthrough). */
export function svgMatrixValues(look: ColorLook): string {
  const { m, o } = look
  const rows = [
    [m[0], m[1], m[2], 0, o[0]],
    [m[3], m[4], m[5], 0, o[1]],
    [m[6], m[7], m[8], 0, o[2]],
    [0, 0, 0, 1, 0],
  ]
  return rows.map((r) => r.map(r6).join(' ')).join(' ')
}

/** feFuncR/G/B tableValues, or null when there is no curve. */
export function svgCurveTables(look: ColorLook): [string, string, string] | null {
  if (!look.curve) return null
  return look.curve.map((t) => t.map(r6).join(' ')) as [string, string, string]
}

/** Stable short key for a look (SVG filter id / LUT cache name). */
export function lookKey(spec: ColorSpec | undefined | null): string {
  if (isIdentitySpec(spec)) return 'id'
  const parts = [spec?.preset ?? '-', String(Math.round(Number(spec?.intensity ?? 100)))]
  for (const k of ADJUST_KEYS) parts.push(String(Math.round(Number(spec?.adjust?.[k] ?? 0))))
  // G4a: the v2 fields add a hash of their canonical form (E4-only keys are unchanged).
  if (hasGradeFields(spec)) parts.push('g' + fnv1a(canonGrade(spec)))
  return parts.join('_').replace(/[^a-z0-9_-]/gi, '')
}

// ── G4a grade (pointwise part) ─────────────────────────────────────────────

export type GradeParts = {
  m: Mat3
  o: [number, number, number]
  pre: number[] | null
  post: [number[], number[], number[]] | null
}

/** Exposure table → E4 affine → post tables. Mirrors color_grade.grade_parts. */
export function gradeParts(spec: ColorSpec | undefined | null): GradeParts {
  const look = lookForSpec(spec)
  const s = spec ?? {}
  return { m: look.m, o: look.o, pre: preTable(s), post: postTables(s, look.curve, curveAt) }
}

/** True when the spec needs the v2 path (tables / 3D stage) instead of the E4 look. */
export function isV2Spec(spec: ColorSpec | undefined | null): boolean {
  return hasPointwiseV2(spec)
}

/** Pointwise grade of one sRGB pixel (0..1). E4-only specs → applyLook (identical to before). */
export function gradeRgb(spec: ColorSpec | undefined | null, rgb: Rgb, lut?: CubeLut | null, parts?: GradeParts): Rgb {
  if (!spec || !hasPointwiseV2(spec)) return applyLook(lookForSpec(spec), rgb)
  const p = parts ?? gradeParts(spec)
  let x: Rgb = needs3d(spec) ? stage3d(spec, rgb, lut) : rgb
  if (p.pre) x = [tableAt(p.pre, x[0]), tableAt(p.pre, x[1]), tableAt(p.pre, x[2])]
  const v = mulV(p.m, x).map((q, i) => clampN(q + p.o[i]!, 0, 1)) as Rgb
  if (!p.post) return v
  return [tableAt(p.post[0], v[0]), tableAt(p.post[1], v[1]), tableAt(p.post[2], v[2])]
}

/** size³ × 3 grid in .cube order (R fastest) — what the export writes and the WebGL path samples. */
export function bakeGrid(spec: ColorSpec | undefined | null, size = GRID, lut?: CubeLut | null): Float32Array {
  const out = new Float32Array(size * size * size * 3)
  const parts = spec && hasPointwiseV2(spec) ? gradeParts(spec) : undefined
  const look = parts ? null : lookForSpec(spec)
  let i = 0
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const x: Rgb = [r / (size - 1), g / (size - 1), b / (size - 1)]
        const v = look ? applyLook(look, x) : gradeRgb(spec, x, lut, parts)
        out[i++] = v[0]
        out[i++] = v[1]
        out[i++] = v[2]
      }
  return out
}

/** 256-entry tables as SVG tableValues strings. */
export function svgTable(t: number[]): string {
  return t.map(r6).join(' ')
}
export { V2_ADJUST }

// ── Normalization / resolution ─────────────────────────────────────────────

export function normalizeColorSpec(raw: unknown): ColorSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const out: ColorSpec = {}
  if (typeof o.preset === 'string' && (COLOR_PRESET_IDS as string[]).includes(o.preset)) {
    out.preset = o.preset as ColorPresetId
    const it = Number(o.intensity)
    if (Number.isFinite(it) && it !== 100) out.intensity = Math.round(clampN(it, 0, 100))
  }
  if (o.adjust && typeof o.adjust === 'object') {
    const a = o.adjust as Record<string, unknown>
    const adj: Partial<ColorAdjust> = {}
    for (const k of ADJUST_KEYS_ALL) {
      const n = Number(a[k])
      if (Number.isFinite(n) && Math.round(n) !== 0) adj[k] = Math.round(clampN(n, ADJUST_MIN, ADJUST_MAX))
    }
    if (Object.keys(adj).length) out.adjust = adj
  }
  Object.assign(out, normalizeGradeFields(o))
  return isIdentitySpec(out) ? undefined : out
}

export function normalizeColorEdits(raw: unknown, brollIds?: Set<string>): ClipColorEdits | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const out: ClipColorEdits = {}
  const video = normalizeColorSpec(o.video)
  if (video) out.video = video
  if (Array.isArray(o.segments)) {
    const segs: SegmentLook[] = []
    for (const r of o.segments) {
      if (!r || typeof r !== 'object') continue
      const s = r as Record<string, unknown>
      const a = Math.round(Number(s.fromMs))
      const b = Math.round(Number(s.toMs))
      if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue
      // An explicit identity override is meaningful (it exempts a clip from the global look).
      const spec = normalizeColorSpec(s.spec) ?? {}
      segs.push({ fromMs: Math.max(0, a), toMs: b, spec })
    }
    if (segs.length) out.segments = segs.sort((x, y) => x.fromMs - y.fromMs).slice(0, 200)
  }
  if (o.broll && typeof o.broll === 'object') {
    const map: Record<string, ColorSpec> = {}
    for (const [id, v] of Object.entries(o.broll as Record<string, unknown>)) {
      if (brollIds && !brollIds.has(id)) continue
      const spec = normalizeColorSpec(v)
      if (spec) map[id] = spec
    }
    if (Object.keys(map).length) out.broll = map
  }
  return out.video || out.segments || out.broll ? out : undefined
}

/** Spec for the main video at a source ms: the latest-added overlapping segment override, else global. */
export function videoSpecAtSource(color: ClipColorEdits | undefined, srcMs: number): ColorSpec | undefined {
  if (!color) return undefined
  const segs = color.segments ?? []
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i]
    if (srcMs >= s.fromMs && srcMs < s.toMs) return isIdentitySpec(s.spec) ? undefined : s.spec
  }
  return color.video
}

export function hasColor(color: ClipColorEdits | undefined): boolean {
  if (!color) return false
  if (color.video && !isIdentitySpec(color.video)) return true
  if (color.segments?.some((s) => !isIdentitySpec(s.spec))) return true
  return Object.values(color.broll ?? {}).some((s) => !isIdentitySpec(s))
}

/** Set (or clear with null) the look of one Video-lane item's source range. */
export function setSegmentLook(
  color: ClipColorEdits | undefined,
  fromMs: number,
  toMs: number,
  spec: ColorSpec | null,
): ClipColorEdits | undefined {
  const keep = (color?.segments ?? []).filter((s) => s.toMs <= fromMs || s.fromMs >= toMs)
  // Partially overlapping older overrides are clipped to outside the new range.
  for (const s of color?.segments ?? []) {
    if (s.toMs <= fromMs || s.fromMs >= toMs) continue
    if (s.fromMs < fromMs) keep.push({ ...s, toMs: fromMs })
    if (s.toMs > toMs) keep.push({ ...s, fromMs: toMs })
  }
  if (spec) keep.push({ fromMs, toMs, spec: normalizeColorSpec(spec) ?? {} })
  return normalizeColorEdits({ ...(color ?? {}), segments: keep.sort((a, b) => a.fromMs - b.fromMs) })
}

export function setVideoLook(color: ClipColorEdits | undefined, spec: ColorSpec | null, clearSegments = false) {
  return normalizeColorEdits({ ...(color ?? {}), video: spec ?? undefined, segments: clearSegments ? undefined : color?.segments })
}

export function setBrollLook(color: ClipColorEdits | undefined, id: string, spec: ColorSpec | null) {
  const broll = { ...(color?.broll ?? {}) }
  if (spec) broll[id] = spec
  else delete broll[id]
  return normalizeColorEdits({ ...(color ?? {}), broll })
}
