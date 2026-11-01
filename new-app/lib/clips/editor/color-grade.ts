/**
 * G4a color grade v2 — shared math for preview and export. Line-for-line mirror of
 * worker/clips_worker/color_grade.py. Only imports fx-library.ts (itself import-free; color.ts composes
 * this module with the E4 affine look).
 *
 * A spec with any G4a field is graded as:
 *   x1 = hsl(mix(x, userLUT(x), lutIntensity))     "3D stage" (only with HSL ranges or a LUT)
 *   x2 = Tpre_c(x1)                                  exposure (256-entry table per channel)
 *   x3 = clamp01(M · x2 + o)                         E4 affine (preset + Adjust sliders)
 *   x4 = Tpost_c(x3)                                 preset curve → highlights / shadows →
 *                                                    lift / gamma / gain → master → R/G/B curve
 *   then, in frame space: sharpen 5×5 → vignette (multiply) → grain (grain-merge)
 *
 * Tables are 256 samples read with linear interpolation = SVG feComponentTransfer `table`.
 * Export bakes the pointwise grade into a GRID³ .cube for ffmpeg lut3d (tetrahedral); the preview
 * runs the SVG chain (no 3D stage) or samples the SAME grid in WebGL with `tetra` below.
 */

import { FX2_KEYS, type Fx2Key } from '@/lib/clips/editor/fx-library'
export const V2_ADJUST = ['exposure', 'highlights', 'shadows'] as const
export type V2AdjustKey = (typeof V2_ADJUST)[number]
/** EF-05: tone extras (not in canon `a` part — separate `t` lookKey segment). */
export const V2_TONE = ['whites', 'blacks', 'fade'] as const
export type V2ToneKey = (typeof V2_TONE)[number]
export const HSL_RANGES = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'] as const
export type HslRange = (typeof HSL_RANGES)[number]
export const HSL_CENTERS = [0, 30, 60, 120, 180, 240, 280, 320] as const
export const HSL_LABELS: Record<HslRange, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  cyan: 'Cyan',
  blue: 'Blue',
  purple: 'Purple',
  magenta: 'Magenta',
}
export const CURVE_CHANNELS = ['m', 'r', 'g', 'b'] as const
export type CurveChannel = (typeof CURVE_CHANNELS)[number]
export const WHEELS = ['lift', 'gamma', 'gain'] as const
export type WheelId = (typeof WHEELS)[number]
export const FX_KEYS = ['sharpen', 'vignette', 'grain'] as const
export type FxKey = (typeof FX_KEYS)[number]
/** G4b: G4a fx + the effects library (fx-library.ts); canonical string adds the new ones as "e…". */
export const FX_ALL = [...FX_KEYS, ...FX2_KEYS] as const
export type FxAnyKey = FxKey | Fx2Key
export const TABLE_N = 255
export const GRID = 33
export const CURVE_MAX_POINTS = 8
export const LUT_MAX_SIZE = 65
export const COLOR_STEP_MS = 100
export const GRAIN_FRAMES = 8
export const GRAIN_PAD = 32

export type CurvePts = [number, number][]
export type Wheel = { x: number; y: number; l: number }
export type HslAdj = { h: number; s: number; l: number }
export type GradeFields = {
  curves?: Partial<Record<CurveChannel, CurvePts>>
  wheels?: Partial<Record<WheelId, Wheel>>
  hsl?: Partial<Record<HslRange, HslAdj>>
  lut?: { id: string; intensity?: number }
  fx?: Partial<Record<FxAnyKey, number>>
}
/** The slice of a ColorSpec this module reads. */
export type GradeSpecLike = GradeFields & { adjust?: Partial<Record<string, number>> }
export type CubeLut = { size: number; dmin: number[]; dmax: number[]; data: Float64Array | number[] }
export type Rgb = [number, number, number]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
function num(v: unknown, d = 0): number {
  const f = Number(v)
  return v === null || v === undefined || v === '' || !Number.isFinite(f) ? d : f
}
const r3 = (v: number) => Math.floor(v * 1000 + 0.5) / 1000
const ri = (v: number) => Math.floor(v + 0.5)

// ── normalization ───────────────────────────────────────────────────────────

export function normalizeCurve(raw: unknown): CurvePts | null {
  if (!Array.isArray(raw)) return null
  const pts: CurvePts = []
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue
    const x = num(p[0], -1)
    const y = num(p[1], -1)
    if (!(x >= 0 && x <= 1) || !(y >= -0.0001 && y <= 1.0001)) continue
    pts.push([r3(x), r3(clamp(y, 0, 1))])
  }
  pts.sort((a, b) => a[0] - b[0])
  let out: CurvePts = []
  for (const p of pts) {
    if (out.length && p[0] - out[out.length - 1]![0] < 0.01) out[out.length - 1] = p
    else out.push(p)
  }
  out = out.slice(0, CURVE_MAX_POINTS)
  if (out.length < 2) return null
  if (out.length === 2 && out[0]![0] === 0 && out[0]![1] === 0 && out[1]![0] === 1 && out[1]![1] === 1) return null
  return out
}

export function normalizeWheel(raw: unknown): Wheel | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  let x = num(o.x)
  let y = num(o.y)
  const l = num(o.l)
  const r = Math.hypot(x, y)
  if (r > 1) {
    x /= r
    y /= r
  }
  const w = { x: r3(x), y: r3(y), l: r3(clamp(l, -1, 1)) }
  return w.x === 0 && w.y === 0 && w.l === 0 ? null : w
}

export function normalizeGradeFields(raw: Record<string, unknown>): GradeFields {
  const out: GradeFields = {}
  if (raw.curves && typeof raw.curves === 'object') {
    const cv = raw.curves as Record<string, unknown>
    const c: Partial<Record<CurveChannel, CurvePts>> = {}
    for (const k of CURVE_CHANNELS) {
      const v = normalizeCurve(cv[k])
      if (v) c[k] = v
    }
    if (Object.keys(c).length) out.curves = c
  }
  if (raw.wheels && typeof raw.wheels === 'object') {
    const wh = raw.wheels as Record<string, unknown>
    const w: Partial<Record<WheelId, Wheel>> = {}
    for (const k of WHEELS) {
      const v = normalizeWheel(wh[k])
      if (v) w[k] = v
    }
    if (Object.keys(w).length) out.wheels = w
  }
  if (raw.hsl && typeof raw.hsl === 'object') {
    const hs = raw.hsl as Record<string, unknown>
    const h: Partial<Record<HslRange, HslAdj>> = {}
    for (const k of HSL_RANGES) {
      const v = hs[k]
      if (!v || typeof v !== 'object') continue
      const o = v as Record<string, unknown>
      const a = { h: ri(clamp(num(o.h), -100, 100)), s: ri(clamp(num(o.s), -100, 100)), l: ri(clamp(num(o.l), -100, 100)) }
      if (a.h || a.s || a.l) h[k] = a
    }
    if (Object.keys(h).length) out.hsl = h
  }
  if (raw.lut && typeof raw.lut === 'object') {
    const l = raw.lut as Record<string, unknown>
    if (typeof l.id === 'string' && l.id.length > 0 && l.id.length <= 64) {
      const it = ri(clamp(num(l.intensity, 100), 0, 100))
      if (it > 0) out.lut = it !== 100 ? { id: l.id, intensity: it } : { id: l.id }
    }
  }
  if (raw.fx && typeof raw.fx === 'object') {
    const fx = raw.fx as Record<string, unknown>
    const f: Partial<Record<FxAnyKey, number>> = {}
    for (const k of FX_ALL) {
      const v = ri(clamp(num(fx[k]), 0, 100))
      if (v) f[k] = v
    }
    if (Object.keys(f).length) out.fx = f
  }
  return out
}

export function hasGradeFields(spec: GradeSpecLike | null | undefined): boolean {
  if (!spec) return false
  if (V2_ADJUST.some((k) => num(spec.adjust?.[k]) !== 0)) return true
  if (V2_TONE.some((k) => num(spec.adjust?.[k]) !== 0)) return true
  return Boolean(spec.curves || spec.wheels || spec.hsl || spec.lut || spec.fx)
}

export function hasPointwiseV2(spec: GradeSpecLike | null | undefined): boolean {
  if (!spec) return false
  if (V2_ADJUST.some((k) => num(spec.adjust?.[k]) !== 0)) return true
  if (V2_TONE.some((k) => num(spec.adjust?.[k]) !== 0)) return true
  return Boolean(spec.curves || spec.wheels || spec.hsl || spec.lut)
}

export function needs3d(spec: GradeSpecLike | null | undefined): boolean {
  return Boolean(spec && (spec.hsl || spec.lut))
}

export function specFx(spec: GradeSpecLike | null | undefined): Record<FxAnyKey, number> {
  const fx = spec?.fx
  return Object.fromEntries(FX_ALL.map((k) => [k, fx?.[k] ?? 0])) as Record<FxAnyKey, number>
}

export function hasFx(spec: GradeSpecLike | null | undefined): boolean {
  const f = specFx(spec)
  return FX_ALL.some((k) => f[k])
}

function fmt(v: number): string {
  let s = v.toFixed(3)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' || s === '' ? '0' : s
}

/** Canonical string of the G4a fields (stable across TS / Python). */
export function canonGrade(spec: GradeSpecLike | null | undefined): string {
  if (!spec) return ''
  const parts = ['a' + V2_ADJUST.map((k) => String(ri(num(spec.adjust?.[k])))).join(',')]
  if (V2_TONE.some((k) => num(spec.adjust?.[k]) !== 0)) {
    parts.push('t' + V2_TONE.map((k) => String(ri(num(spec.adjust?.[k])))).join(','))
  }
  for (const k of CURVE_CHANNELS) {
    const c = spec.curves?.[k]
    if (c?.length) parts.push(`c${k}` + c.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(';'))
  }
  for (const k of WHEELS) {
    const w = spec.wheels?.[k]
    if (w) parts.push(`w${k}${fmt(w.x)},${fmt(w.y)},${fmt(w.l)}`)
  }
  for (const k of HSL_RANGES) {
    const v = spec.hsl?.[k]
    if (v) parts.push(`h${k}${v.h},${v.s},${v.l}`)
  }
  if (spec.lut) parts.push(`l${spec.lut.id},${spec.lut.intensity ?? 100}`)
  const fx = specFx(spec)
  if (fx.sharpen || fx.vignette || fx.grain) parts.push('f' + FX_KEYS.map((k) => String(fx[k])).join(','))
  if (FX2_KEYS.some((k) => fx[k])) parts.push('e' + FX2_KEYS.filter((k) => fx[k]).map((k) => `${k}${fx[k]}`).join(','))
  return parts.join('|')
}

export function fnv1a(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let h = 0x811c9dc5
  for (const b of bytes) {
    h ^= b
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// ── 1D tables ───────────────────────────────────────────────────────────────

export const srgbDec = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
export const srgbEnc = (y: number) => (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055)

/** Fritsch–Carlson monotone cubic tangents. */
export function curveSlopes(pts: CurvePts): number[] {
  const n = pts.length
  const d: number[] = []
  for (let k = 0; k < n - 1; k++) d.push((pts[k + 1]![1] - pts[k]![1]) / (pts[k + 1]![0] - pts[k]![0]))
  const m = new Array<number>(n).fill(0)
  m[0] = d[0]!
  m[n - 1] = d[n - 2]!
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1]! * d[k]! > 0 ? (d[k - 1]! + d[k]!) / 2 : 0
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0
      m[k + 1] = 0
      continue
    }
    const a = m[k]! / d[k]!
    const b = m[k + 1]! / d[k]!
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[k] = t * a * d[k]!
      m[k + 1] = t * b * d[k]!
    }
  }
  return m
}

export function curveEval(pts: CurvePts, m: number[], x: number): number {
  const n = pts.length
  if (x <= pts[0]![0]) return pts[0]![1]
  if (x >= pts[n - 1]![0]) return pts[n - 1]![1]
  let k = 0
  while (k < n - 2 && x >= pts[k + 1]![0]) k++
  const h = pts[k + 1]![0] - pts[k]![0]
  const t = (x - pts[k]![0]) / h
  const t2 = t * t
  const t3 = t2 * t
  const y =
    (2 * t3 - 3 * t2 + 1) * pts[k]![1] +
    (t3 - 2 * t2 + t) * h * m[k]! +
    (-2 * t3 + 3 * t2) * pts[k + 1]![1] +
    (t3 - t2) * h * m[k + 1]!
  return clamp(y, 0, 1)
}

const PHI = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]

export function wheelD(w: Wheel | undefined, c: number): number {
  if (!w) return 0
  return w.l + w.x * Math.cos(PHI[c]!) + w.y * Math.sin(PHI[c]!)
}

export function toneHs(y0: number, hi: number, sh: number): number {
  let y = y0 + sh * 0.6 * y0 * (1 - y0) * (1 - y0)
  y = y + hi * 0.6 * y * y * (1 - y)
  return clamp(y, 0, 1)
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** EF-05: whites / blacks / fade after highlights & shadows. */
export function toneExtras(y0: number, wt: number, bk: number, fd: number): number {
  if (wt === 0 && bk === 0 && fd === 0) return y0
  let y = y0 + 0.25 * wt * smoothstep(0.5, 1, y0) + 0.25 * bk * (1 - smoothstep(0, 0.5, y0))
  y = clamp(y, 0, 1)
  return 0.2 * fd + y * (1 - 0.3 * fd)
}

export function preTable(spec: GradeSpecLike): number[] | null {
  const ev = (clamp(num(spec.adjust?.exposure), -100, 100) / 100) * 2
  if (ev === 0) return null
  const g = 2 ** ev
  const out: number[] = []
  for (let i = 0; i <= TABLE_N; i++) out.push(srgbEnc(Math.min(1, srgbDec(i / TABLE_N) * g)))
  return out
}

/** Per-channel 256 tables: preset curve → highlights/shadows → wheels → master → channel curve. */
export function postTables(
  spec: GradeSpecLike,
  presetCurve: number[][] | null,
  curveAt: (tab: number[], x: number) => number,
): [number[], number[], number[]] | null {
  const hi = clamp(num(spec.adjust?.highlights), -100, 100) / 100
  const sh = clamp(num(spec.adjust?.shadows), -100, 100) / 100
  const wt = clamp(num(spec.adjust?.whites), -100, 100) / 100
  const bk = clamp(num(spec.adjust?.blacks), -100, 100) / 100
  const fd = clamp(num(spec.adjust?.fade), 0, 100) / 100
  const wh = spec.wheels ?? {}
  const cv = spec.curves ?? {}
  if (!presetCurve && hi === 0 && sh === 0 && wt === 0 && bk === 0 && fd === 0 && !spec.wheels && !spec.curves) return null
  const mpts = cv.m
  const mm = mpts ? curveSlopes(mpts) : null
  const out: number[][] = []
  ;(['r', 'g', 'b'] as const).forEach((ck, c) => {
    const cpts = cv[ck]
    const cm = cpts ? curveSlopes(cpts) : null
    const lift = 0.25 * wheelD(wh.lift, c)
    const gain = 1 + 0.5 * wheelD(wh.gain, c)
    const gexp = 2 ** (-0.75 * wheelD(wh.gamma, c))
    const tab: number[] = []
    for (let i = 0; i <= TABLE_N; i++) {
      let y = i / TABLE_N
      if (presetCurve) y = curveAt(presetCurve[c]!, y)
      y = toneHs(y, hi, sh)
      y = toneExtras(y, wt, bk, fd)
      y = clamp(gain * (y + lift * (1 - y)), 0, 1)
      y = y ** gexp
      if (mpts) y = curveEval(mpts, mm!, y)
      if (cpts) y = curveEval(cpts, cm!, y)
      tab.push(y)
    }
    out.push(tab)
  })
  return out as [number[], number[], number[]]
}

export function tableAt(t: number[], x: number): number {
  const f = clamp(x, 0, 1) * TABLE_N
  const k = Math.min(TABLE_N - 1, Math.floor(f))
  return t[k]! + (f - k) * (t[k + 1]! - t[k]!)
}

// ── 3D stage ────────────────────────────────────────────────────────────────

/** ffmpeg vf_lut3d interp_tetrahedral; grid in .cube order (R fastest); s scaled to [0, size−1]. */
export function tetra(grid: ArrayLike<number>, size: number, s0: Rgb): Rgb {
  const lm = size - 1
  const s = [clamp(s0[0], 0, lm), clamp(s0[1], 0, lm), clamp(s0[2], 0, lm)]
  const p = s.map((v) => Math.floor(v))
  const n = p.map((v) => Math.min(v + 1, lm))
  const dr = s[0]! - p[0]!
  const dg = s[1]! - p[1]!
  const db = s[2]! - p[2]!
  const c = (ri0: number, gi: number, bi: number, ch: number) => grid[((bi * size + gi) * size + ri0) * 3 + ch]!
  const [pr, pg, pb] = p as [number, number, number]
  const [nr, ng, nb] = n as [number, number, number]
  const out: Rgb = [0, 0, 0]
  for (let ch = 0; ch < 3; ch++) {
    const c000 = c(pr, pg, pb, ch)
    const c111 = c(nr, ng, nb, ch)
    let v: number
    if (dr > dg) {
      if (dg > db) v = (1 - dr) * c000 + (dr - dg) * c(nr, pg, pb, ch) + (dg - db) * c(nr, ng, pb, ch) + db * c111
      else if (dr > db) v = (1 - dr) * c000 + (dr - db) * c(nr, pg, pb, ch) + (db - dg) * c(nr, pg, nb, ch) + dg * c111
      else v = (1 - db) * c000 + (db - dr) * c(pr, pg, nb, ch) + (dr - dg) * c(nr, pg, nb, ch) + dg * c111
    } else {
      if (db > dg) v = (1 - db) * c000 + (db - dg) * c(pr, pg, nb, ch) + (dg - dr) * c(pr, ng, nb, ch) + dr * c111
      else if (db > dr) v = (1 - dg) * c000 + (dg - db) * c(pr, ng, pb, ch) + (db - dr) * c(pr, ng, nb, ch) + dr * c111
      else v = (1 - dg) * c000 + (dg - dr) * c(pr, ng, pb, ch) + (dr - db) * c(nr, ng, pb, ch) + db * c111
    }
    out[ch] = v
  }
  return out
}

export class CubeParseError extends Error {}

/** .cube (Adobe / Resolve) 3D LUT text → CubeLut. */
export function parseCube(text: string): CubeLut {
  let size = 0
  let dmin = [0, 0, 0]
  let dmax = [1, 1, 1]
  const vals: number[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/\s+/)
    const head = parts[0]!.toUpperCase()
    if (head === 'TITLE') continue
    if (head === 'LUT_1D_SIZE') throw new CubeParseError('1D LUTs are not supported — export a 3D .cube')
    if (head === 'LUT_3D_SIZE') {
      size = parseInt(parts[1] ?? '', 10)
      continue
    }
    if (head === 'DOMAIN_MIN') {
      dmin = parts.slice(1, 4).map(Number)
      continue
    }
    if (head === 'DOMAIN_MAX') {
      dmax = parts.slice(1, 4).map(Number)
      continue
    }
    if (head.startsWith('LUT_') || /^[A-Z]+$/.test(head)) continue
    if (parts.length < 3) throw new CubeParseError('Bad LUT row')
    vals.push(Number(parts[0]), Number(parts[1]), Number(parts[2]))
  }
  if (!(size >= 2 && size <= LUT_MAX_SIZE)) throw new CubeParseError(`LUT size must be 2..${LUT_MAX_SIZE}`)
  if (vals.length !== size ** 3 * 3) throw new CubeParseError('LUT has the wrong number of rows')
  if (vals.some((v) => !Number.isFinite(v))) throw new CubeParseError('LUT has a non-numeric value')
  if (dmin.length !== 3 || dmax.length !== 3 || [0, 1, 2].some((i) => !(dmax[i]! > dmin[i]!)))
    throw new CubeParseError('Bad LUT domain')
  return { size, dmin, dmax, data: Float64Array.from(vals) }
}

export function lutApply(lut: CubeLut, x: Rgb): Rgb {
  const s: Rgb = [0, 1, 2].map((i) => ((x[i]! - lut.dmin[i]!) / (lut.dmax[i]! - lut.dmin[i]!)) * (lut.size - 1)) as Rgb
  const v = tetra(lut.data, lut.size, s)
  return [clamp(v[0], 0, 1), clamp(v[1], 0, 1), clamp(v[2], 0, 1)]
}

export function hslWeights(h: number): number[] {
  const n = HSL_CENTERS.length
  const w = new Array<number>(n).fill(0)
  for (let k = 0; k < n; k++) {
    const a = HSL_CENTERS[k]!
    const b = HSL_CENTERS[(k + 1) % n]! + (k === n - 1 ? 360 : 0)
    const hh = h < a ? h + 360 : h
    if (hh >= a && hh < b) {
      const t = (hh - a) / (b - a)
      w[k]! += 1 - t
      w[(k + 1) % n]! += t
    }
  }
  return w
}

const mod = (a: number, b: number) => a - b * Math.floor(a / b)

export function hslApply(hsl: Partial<Record<HslRange, HslAdj>>, x: Rgb): Rgb {
  const [r, g, b] = x
  const mx = Math.max(Math.max(r, g), b)
  const mn = Math.min(Math.min(r, g), b)
  const c = mx - mn
  if (!(c > 1e-9)) return x
  let hue = mx === r ? mod((g - b) / c, 6) : mx === g ? (b - r) / c + 2 : (r - g) / c + 4
  hue = mod(hue * 60, 360)
  const w = hslWeights(hue)
  let dh = 0
  let ds = 0
  let dl = 0
  HSL_RANGES.forEach((k, i) => {
    const a = hsl[k]
    dh += w[i]! * ((a?.h ?? 0) / 100)
    ds += w[i]! * ((a?.s ?? 0) / 100)
    dl += w[i]! * ((a?.l ?? 0) / 100)
  })
  dh *= 30
  const L = (mx + mn) / 2
  const den = 1 - Math.abs(2 * L - 1)
  const S = den > 1e-9 ? c / den : 0
  const H2 = mod(hue + dh, 360)
  const S2 = clamp(S * (1 + ds), 0, 1)
  const L2 = clamp(L + 0.25 * dl * c, 0, 1)
  const C2 = (1 - Math.abs(2 * L2 - 1)) * S2
  const hp = H2 / 60
  const X = C2 * (1 - Math.abs(mod(hp, 2) - 1))
  const m = L2 - C2 / 2
  const seg = Math.min(5, Math.floor(hp))
  const rr = [C2, X, 0, 0, X, C2][seg]!
  const gg = [X, C2, C2, X, 0, 0][seg]!
  const bb = [0, 0, X, C2, C2, X][seg]!
  return [clamp(rr + m, 0, 1), clamp(gg + m, 0, 1), clamp(bb + m, 0, 1)]
}

export function stage3d(spec: GradeSpecLike, x: Rgb, lut: CubeLut | null | undefined): Rgb {
  let v = x
  if (spec.lut && lut) {
    const it = num(spec.lut.intensity ?? 100, 100) / 100
    const y = lutApply(lut, v)
    v = [v[0] + (y[0] - v[0]) * it, v[1] + (y[1] - v[1]) * it, v[2] + (y[2] - v[2]) * it]
  }
  if (spec.hsl) v = hslApply(spec.hsl, v)
  return v
}

// ── spatial effects ─────────────────────────────────────────────────────────

export const SHARPEN_DIVISOR = 2500
export const sharpenQ = (amount: number) => ri(clamp(amount, 0, 100) * 1.5)
export function sharpenKernel(amount: number): number[] {
  const q = sharpenQ(amount)
  const k = new Array<number>(25).fill(-q)
  k[12] = 2500 + 24 * q
  return k
}

export function vignetteMaskValue(amount: number, u: number, v: number): number {
  const a = (clamp(amount, 0, 100) / 100) * 0.85
  const d = Math.sqrt(((u - 0.5) * 2) ** 2 + ((v - 0.5) * 2) ** 2) / Math.sqrt(2)
  const t = clamp((d - 0.35) / (1.05 - 0.35), 0, 1)
  return 1 - a * (t * t * (3 - 2 * t))
}

/** uint8 multiply mask (pixel centres), row-major h × w. */
export function vignetteMask(amount: number, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out[y * w + x] = Math.floor(vignetteMaskValue(amount, (x + 0.5) / w, (y + 0.5) / h) * 255 + 0.5)
  return out
}

/** 32-bit integer hash → 0..255. */
export function grainHash(x: number, y: number, k: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 2246822519 | 0)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h & 255
}

export const grainCell = (playH: number) => Math.max(1, ri(playH / 720))
export function grainOffset(frame: number): [number, number] {
  const k = mod(frame, GRAIN_FRAMES)
  return [(k * 13) % GRAIN_PAD, (k * 29) % GRAIN_PAD]
}
/** uint8 (gh + PAD) × (gw + PAD) grain-merge cells: 128 ± amp. */
export function grainCells(amount: number, gw: number, gh: number): Uint8Array {
  const amp = (clamp(amount, 0, 100) / 100) * 40
  const W = gw + GRAIN_PAD
  const H = gh + GRAIN_PAD
  const out = new Uint8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) out[y * W + x] = Math.floor(128 + (amp * (grainHash(x, y, 7) - 127.5)) / 127.5 + 0.5)
  return out
}

// ── keyframed color ─────────────────────────────────────────────────────────

export const COLOR_KEY_PROPS = {
  cExposure: 'exposure',
  cBrightness: 'brightness',
  cContrast: 'contrast',
  cSaturation: 'saturation',
  cTemperature: 'temperature',
  cTint: 'tint',
  cHighlights: 'highlights',
  cShadows: 'shadows',
  cVibrance: 'vibrance',
  cWhites: 'whites',
  cBlacks: 'blacks',
  cFade: 'fade',
} as const
export type ColorKeyProp = keyof typeof COLOR_KEY_PROPS
export const COLOR_KEY_PROP_LIST = Object.keys(COLOR_KEY_PROPS) as ColorKeyProp[]
/** G4c: keyframable effect amounts → spec.fx (color_grade.FX_KEY_PROPS). */
export const FX_KEY_PROPS = {
  fxSharpen: 'sharpen',
  fxVignette: 'vignette',
  fxGrain: 'grain',
  fxBlur: 'blur',
  fxGlow: 'glow',
  fxRgbsplit: 'rgbsplit',
  fxGlitch: 'glitch',
  fxShake: 'shake',
  fxFlicker: 'flicker',
  fxScanlines: 'scanlines',
  fxPixelate: 'pixelate',
} as const satisfies Record<string, FxAnyKey>
export type FxKeyProp = keyof typeof FX_KEY_PROPS
export const FX_KEY_QUANT = 5
/** Keyframed effect amount → 0..100 in FX_KEY_QUANT steps (color_grade.quant_fx). */
export function quantFx(v: number): number {
  const n = Math.max(0, Math.min(100, v))
  return Math.floor(n / FX_KEY_QUANT + 0.5) * FX_KEY_QUANT
}

export const stepOf = (localMs: number) => Math.floor(localMs / COLOR_STEP_MS)
