/**
 * G4b TS ↔ Py parity (tests/fixtures/g4b_parity.json, written by worker/tests/g4b_parity_gen.py from
 * the Python models, which worker tests check against real ffmpeg 5.1): xfade shape / soft / slice /
 * corner weights, layer masks, chroma key + despill, effects library runtime, layerFx normalization.
 */
import { describe, expect, it } from 'vitest'
import fixture from './fixtures/g4b_parity.json'
import { windowProgress, xfadeBWeight } from '@/lib/clips/editor/transitions'
import { keyPixel, maskAlpha, maskGeomAt, normalizeLayerFx, type ChromaKey, type LayerMask, type MaskGeom, type MaskShape } from '@/lib/clips/editor/layer-fx'
import * as fl from '@/lib/clips/editor/fx-library'

const F = fixture as unknown as {
  xfade: { W: number; H: number; cases: { name: string; n: number; k: number; P: number; w: number[] }[] }
  masks: { shape: MaskShape; g: MaskGeom; invert: boolean; W: number; H: number; mw: number; mh: number; sum: [number, number]; samples: [number, number, number][] }[]
  maskKeyed: LayerMask
  maskGeom: { ms: number; g: MaskGeom }[]
  key: { key: ChromaKey; px: [number, number, number][]; out: [number, [number, number, number]][] }[]
  fx: Record<string, unknown>[]
  normalize: { in: unknown; out: unknown }
}

function checksum(a: ArrayLike<number>): [number, number] {
  let s = 0
  let t = 0n
  for (let i = 0; i < a.length; i++) {
    s += a[i]!
    t += BigInt(a[i]!) * BigInt((i % 9973) + 1)
  }
  return [s, Number(t % 2147483647n)]
}

describe('G4b parity', () => {
  it('xfade mask weights (23 types × 3 frames)', () => {
    const { W, H } = F.xfade
    let worst = 0
    for (const c of F.xfade.cases) {
      expect(windowProgress(c.k, c.n)).toBe(c.P)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) worst = Math.max(worst, Math.abs(xfadeBWeight(c.name, c.P, x, y, W, H) - c.w[y * W + x]!))
    }
    expect(worst).toBeLessThan(2e-5)
  })

  it('layer masks (grid, feather, rotation, invert)', () => {
    for (const m of F.masks) {
      const a = maskAlpha(m.shape, m.g, m.invert, m.W, m.H)
      expect([a.mw, a.mh]).toEqual([m.mw, m.mh])
      for (const [j, i, v] of m.samples) expect(a.alpha[j * a.mw + i]).toBe(v)
      const [s] = checksum(a.alpha)
      // ±1 level on a handful of smoothstep boundary pixels (float64 both sides; rounding ties).
      expect(Math.abs(s - m.sum[0])).toBeLessThanOrEqual(4)
    }
  })

  it('mask keyframes step at 100 ms', () => {
    for (const { ms, g } of F.maskGeom) {
      const t = maskGeomAt(F.maskKeyed, ms)
      for (const k of Object.keys(g) as (keyof MaskGeom)[]) expect(t[k]).toBeCloseTo(g[k], 5)
    }
  })

  it('chroma key + despill (= ffmpeg colorkey / despill)', () => {
    for (const c of F.key)
      c.px.forEach((p, i) => {
        const r = keyPixel(p, c.key)
        expect([r.a, r.rgb]).toEqual(c.out[i])
      })
  })

  it('effects library runtime', () => {
    for (const c of F.fx as { v: number; W: number; H: number; [k: string]: unknown }[]) {
      const { v, W, H } = c
      expect(fl.blurSigma(v, W, H)).toBeCloseTo(c.blur as number, 6)
      expect(fl.glowOpacity(v)).toBeCloseTo(c.glow as number, 6)
      expect(fl.rgbsplitPx(v, W, H)).toBe(c.rgbsplit)
      expect(fl.glitchBands(v, W, H).map((b) => ({ ...b, amp: Math.round(b.amp * 1e6) / 1e6 }))).toEqual(
        (c.bands as fl.GlitchBand[]).map((b) => ({ ...b, amp: Math.round(b.amp * 1e6) / 1e6 })),
      )
      expect([0, 1, 7, 29, 300].map((f) => fl.glitchState(v, W, H, f))).toEqual(c.glitch)
      expect(fl.shakePad(v, W, H)).toBe(c.shakePad)
      expect(fl.shakeSize(v, W, H)).toEqual(c.shakeSize)
      expect([0, 1, 7, 29, 300].map((f) => fl.shakeOffset(v, W, H, f))).toEqual(c.shake)
      ;[0, 1, 7, 29, 300].forEach((f, i) => expect(fl.flickerGain(v, f)).toBeCloseTo((c.flicker as number[])[i]!, 6))
      expect(fl.scanlinePeriod(W, H)).toBe(c.scanPeriod)
      expect(checksum(fl.scanlineRows(v, W, H))).toEqual(c.scan)
    }
  })

  it('layerFx normalization', () => {
    expect(normalizeLayerFx(F.normalize.in)).toEqual(F.normalize.out)
  })
})
