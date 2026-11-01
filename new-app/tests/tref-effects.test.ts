/**
 * TREF batch 2: EF-05, EF-19, EF-16, EF-12 — shared expectations with worker/tests/test_tref_effects.py
 * @vitest-environment happy-dom
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { adjustSpec } from '@/lib/clips/editor/adjust-layers'
import { toneExtras } from '@/lib/clips/editor/color-grade'
import { pixelateBlock } from '@/lib/clips/editor/fx-library'
import { maskAlpha, type MaskGeom } from '@/lib/clips/editor/layer-fx'
import { GradePreview } from '@/components/clips/editor/g4/grade-preview'
import { normalizeColorSpec } from '@/lib/clips/editor/color'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/tref_effects.json')

const GEOM: MaskGeom = { x: 50, y: 50, w: 80, h: 80, rot: 0, feather: 0 }

function buildFixture() {
  const ys = [0, 0.25, 0.5, 0.75, 1]
  const tone = ys.map((y) => ({
    y,
    w100: toneExtras(y, 1, 0, 0),
    b100: toneExtras(y, 0, 1, 0),
    fade50: toneExtras(y, 0, 0, 0.5),
  }))
  const pixel = [
    { v: 0, w: 1920, h: 1080, b: pixelateBlock(0, 1920, 1080) },
    { v: 50, w: 1920, h: 1080, b: pixelateBlock(50, 1920, 1080) },
    { v: 100, w: 1920, h: 1080, b: pixelateBlock(100, 1920, 1080) },
  ]
  const heart = maskAlpha('heart', GEOM, false, 64, 36)
  const star = maskAlpha('star', GEOM, false, 64, 36)
  const adjust = adjustSpec({ hsl: { red: { h: 10, s: 5, l: 0 } }, lut: { id: 'demo' } })
  return {
    tone,
    pixel,
    maskHeart: Array.from(heart.alpha),
    maskStar: Array.from(star.alpha),
    adjustKeepsHslLut: adjust,
  }
}

describe('tref effects (batch 2)', () => {
  it('tone curve is monotone in y for extreme inputs', () => {
    const ys = [0, 0.25, 0.5, 0.75, 1]
    for (const wt of [-1, 0, 1]) {
      const out = ys.map((y) => toneExtras(y, wt, 0, 0))
      for (let i = 1; i < out.length; i++) expect(out[i]!).toBeGreaterThanOrEqual(out[i - 1]! - 1e-9)
    }
  })

  it('matches worker/tests/fixtures/tref_effects.json', () => {
    const got = buildFixture()
    if (process.env.WRITE_TREF_EFFECTS === '1' || !fs.existsSync(FIXTURE)) {
      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true })
      fs.writeFileSync(FIXTURE, JSON.stringify(got) + '\n')
    }
    const want = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))
    expect(got.tone).toEqual(want.tone)
    expect(got.pixel).toEqual(want.pixel)
    expect(got.maskHeart).toEqual(want.maskHeart)
    expect(got.maskStar).toEqual(want.maskStar)
    expect(got.adjustKeepsHslLut).toEqual(want.adjustKeepsHslLut)
  })

  it('adjust layer keeps hsl and lut', () => {
    const s = adjustSpec({ hsl: { blue: { h: 0, s: 10, l: 0 } }, lut: { id: 'x' } })
    expect(s.hsl?.blue).toEqual({ h: 0, s: 10, l: 0 })
    expect(s.lut?.id).toBe('x')
  })

  it('setAdjust3d changes mirror grid cache key', () => {
    const gp = new GradePreview()
    const clip = normalizeColorSpec({ adjust: { exposure: 5 } })!
    gp.setAdjust3d([{ hsl: { red: { h: 0, s: -100, l: 0 } } }])
    const k1 = gp.gridFor(clip).key
    gp.setAdjust3d(null)
    const k2 = gp.gridFor(clip).key
    expect(k1).not.toBe(k2)
    expect(k1).toContain('|a:')
    gp.dispose()
  })

  it('chain uses spatial-only CSS for adjust layers with HSL', () => {
    const gp = new GradePreview()
    gp.bank.attach(typeof document !== 'undefined' ? document.body : null)
    gp.bank.play = { w: 1920, h: 1080 }
    const css = gp.chain([{ hsl: { green: { h: 0, s: 20, l: 0 } }, fx: { sharpen: 10 } }])
    expect(css).toContain('-sp')
    gp.dispose()
  })
})
