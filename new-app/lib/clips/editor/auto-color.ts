/**
 * G4a Auto color + white-balance eyedropper. Deterministic searches over the panel's own sliders
 * (no AI, no hidden parameters): the result is ordinary Adjust values the user can see and change,
 * and the preview / export apply them with the same math as any manual edit.
 */
import { gradeParts, gradeRgb, type ColorSpec } from '@/lib/clips/editor/color'
import type { CubeLut, Rgb } from '@/lib/clips/editor/color-grade'
import { cbcr709, luma709 } from '@/lib/clips/editor/scopes'

/** Up to `max` evenly strided pixels (0..1) from RGBA bytes. */
export function samplePixels(px: ArrayLike<number>, w: number, h: number, max = 2048): Rgb[] {
  const total = w * h
  const step = Math.max(1, Math.floor(total / max))
  const out: Rgb[] = []
  for (let i = 0; i < total && out.length < max; i += step) out.push([px[i * 4]! / 255, px[i * 4 + 1]! / 255, px[i * 4 + 2]! / 255])
  return out
}

function withAdjust(spec: ColorSpec, patch: Record<string, number>): ColorSpec {
  const adjust = { ...(spec.adjust ?? {}) } as Record<string, number>
  for (const [k, v] of Object.entries(patch)) {
    if (v) adjust[k] = v
    else delete adjust[k]
  }
  return { ...spec, adjust: Object.keys(adjust).length ? adjust : undefined }
}

function chroma(spec: ColorSpec, rgb: Rgb, lut?: CubeLut | null): number {
  const [r, g, b] = gradeRgb(spec, rgb, lut)
  const [cb, cr] = cbcr709(r, g, b)
  return cb * cb + cr * cr
}

/** Temperature / tint (−100..100, integers) that make `rgb` neutral under the rest of `spec`. */
export function solveNeutral(spec: ColorSpec, rgb: Rgb, lut?: CubeLut | null): { temperature: number; tint: number } {
  let best = { temperature: 0, tint: 0 }
  let bestErr = Infinity
  const tryAt = (t: number, n: number) => {
    const e = chroma(withAdjust(spec, { temperature: t, tint: n }), rgb, lut)
    if (e < bestErr - 1e-12) {
      bestErr = e
      best = { temperature: t, tint: n }
    }
  }
  for (let t = -100; t <= 100; t += 10) for (let n = -100; n <= 100; n += 10) tryAt(t, n)
  for (const span of [8, 3, 1]) {
    const c = { ...best }
    for (let t = Math.max(-100, c.temperature - span * 2); t <= Math.min(100, c.temperature + span * 2); t += span)
      for (let n = Math.max(-100, c.tint - span * 2); n <= Math.min(100, c.tint + span * 2); n += span) tryAt(t, n)
  }
  return best
}

function quantile(v: number[], q: number): number {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]!
}

function lumas(spec: ColorSpec, px: Rgb[], lut?: CubeLut | null): number[] {
  const parts = gradeParts(spec)
  return px.map((p) => {
    const [r, g, b] = gradeRgb(spec, p, lut, parts)
    return luma709(r, g, b)
  })
}

export const AUTO_TARGET_MEDIAN = 0.45
export const AUTO_TARGET_SPREAD = 0.88

/**
 * Auto color: gray-world white balance (mid-tone mean → neutral), then exposure so the median luma
 * is ~0.45, then contrast (±50) so the 2–98 % luma spread is ~0.88. Other fields stay as they are.
 */
export function autoColor(spec: ColorSpec, px: Rgb[], lut?: CubeLut | null): ColorSpec {
  if (!px.length) return spec
  const mids = px.filter((p) => {
    const l = luma709(p[0], p[1], p[2])
    return l > 0.08 && l < 0.92
  })
  const pool = mids.length >= 16 ? mids : px
  const mean: Rgb = [0, 1, 2].map((i) => pool.reduce((a, p) => a + p[i]!, 0) / pool.length) as Rgb
  let out = withAdjust(spec, solveNeutral(spec, mean, lut))
  const sub = px.length > 512 ? px.filter((_, i) => i % Math.ceil(px.length / 512) === 0) : px
  let bestE = 0
  let bestErr = Infinity
  for (let e = -60; e <= 60; e += 2) {
    const err = Math.abs(quantile(lumas(withAdjust(out, { exposure: e }), sub, lut), 0.5) - AUTO_TARGET_MEDIAN)
    if (err < bestErr - 1e-9) {
      bestErr = err
      bestE = e
    }
  }
  out = withAdjust(out, { exposure: bestE })
  let bestC = 0
  bestErr = Infinity
  for (let c = -50; c <= 50; c += 5) {
    const l = lumas(withAdjust(out, { contrast: c }), sub, lut)
    const err = Math.abs(quantile(l, 0.98) - quantile(l, 0.02) - AUTO_TARGET_SPREAD) + Math.abs(c) * 1e-4
    if (err < bestErr - 1e-9) {
      bestErr = err
      bestC = c
    }
  }
  return withAdjust(out, { contrast: bestC })
}
