/**
 * G4c color match: make one clip's grade look like a reference clip — by statistics, no AI.
 *
 * Reinhard-style objective in CIE Lab (D65): the per-channel mean and standard deviation of the
 * target's GRADED pixels should equal the reference's (graded with its own look). The result is
 * ordinary Adjust values (exposure, contrast, saturation, temperature, tint — integers, the same
 * sliders the user sees), found by a deterministic coordinate search over gradeRgb, so preview and
 * export apply it like any manual edit. Other fields (curves, wheels, HSL, LUT, fx) stay as they are
 * and are part of the graded result the search measures.
 */
import { gradeParts, gradeRgb, type ColorSpec } from '@/lib/clips/editor/color'
import type { CubeLut, Rgb } from '@/lib/clips/editor/color-grade'

export type Lab = [number, number, number]
export type LabStats = { mean: Lab; std: Lab; n: number }

export const MATCH_KEYS = ['exposure', 'contrast', 'saturation', 'temperature', 'tint'] as const
export type MatchKey = (typeof MATCH_KEYS)[number]
export const MATCH_SAMPLE = 512
/** Channel weights (L carries brightness / contrast, a / b the cast and saturation). */
const W: Lab = [1, 1.4, 1.4]

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)

/** sRGB (0..1) → CIE Lab, D65. */
export function rgbToLab(rgb: Rgb): Lab {
  const r = lin(Math.min(1, Math.max(0, rgb[0])))
  const g = lin(Math.min(1, Math.max(0, rgb[1])))
  const b = lin(Math.min(1, Math.max(0, rgb[2])))
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function labStats(px: readonly Rgb[]): LabStats {
  const n = px.length
  if (!n) return { mean: [0, 0, 0], std: [0, 0, 0], n: 0 }
  const s: Lab = [0, 0, 0]
  const q: Lab = [0, 0, 0]
  for (const p of px) {
    const l = rgbToLab(p)
    for (let i = 0; i < 3; i++) {
      s[i] = s[i]! + l[i]!
      q[i] = q[i]! + l[i]! * l[i]!
    }
  }
  const mean = s.map((v) => v / n) as Lab
  const std = q.map((v, i) => Math.sqrt(Math.max(0, v / n - mean[i]! * mean[i]!))) as Lab
  return { mean, std, n }
}

/** Every pixel through `spec` (gradeRgb), then Lab statistics. */
export function gradedStats(spec: ColorSpec, px: readonly Rgb[], lut?: CubeLut | null): LabStats {
  const parts = gradeParts(spec)
  return labStats(px.map((p) => gradeRgb(spec, p, lut, parts) as Rgb))
}

export function statsDistance(a: LabStats, b: LabStats): number {
  let e = 0
  for (let i = 0; i < 3; i++) {
    const dm = a.mean[i]! - b.mean[i]!
    const ds = a.std[i]! - b.std[i]!
    e += W[i]! * (dm * dm + ds * ds)
  }
  return e
}

function withAdjust(spec: ColorSpec, vals: Record<MatchKey, number>): ColorSpec {
  const adjust = { ...(spec.adjust ?? {}) } as Record<string, number>
  for (const k of MATCH_KEYS) {
    if (vals[k]) adjust[k] = vals[k]
    else delete adjust[k]
  }
  return { ...spec, adjust: Object.keys(adjust).length ? (adjust as ColorSpec['adjust']) : undefined }
}

function subsample(px: readonly Rgb[], max: number): Rgb[] {
  if (px.length <= max) return [...px]
  const step = px.length / max
  const out: Rgb[] = []
  for (let i = 0; i < max; i++) out.push(px[Math.floor(i * step)]!)
  return out
}

export type MatchResult = { spec: ColorSpec; before: number; after: number; values: Record<MatchKey, number> }

/**
 * Adjust values that make `spec` applied to the target's raw pixels match `ref` (Lab mean / std).
 * Coordinate search (spans 20 → 8 → 3 → 1) from the current values; deterministic.
 */
export function matchColor(spec: ColorSpec, px: readonly Rgb[], ref: LabStats, lut?: CubeLut | null): MatchResult {
  const sub = subsample(px, MATCH_SAMPLE)
  const adj = (spec.adjust ?? {}) as Record<string, number | undefined>
  const vals = Object.fromEntries(MATCH_KEYS.map((k) => [k, Math.round(adj[k] ?? 0)])) as Record<MatchKey, number>
  const cost = (v: Record<MatchKey, number>) => statsDistance(gradedStats(withAdjust(spec, v), sub, lut), ref)
  const before = cost(vals)
  let best = before
  for (const span of [20, 8, 3, 1]) {
    for (let pass = 0; pass < 4; pass++) {
      let moved = false
      for (const k of MATCH_KEYS) {
        for (const dir of [1, -1]) {
          const v = Math.max(-100, Math.min(100, vals[k] + dir * span))
          if (v === vals[k]) continue
          const trial = { ...vals, [k]: v }
          const c = cost(trial)
          if (c < best - 1e-9) {
            best = c
            vals[k] = v
            moved = true
          }
        }
      }
      if (!moved) break
    }
  }
  return { spec: withAdjust(spec, vals), before, after: best, values: vals }
}
