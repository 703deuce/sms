import { describe, expect, it } from 'vitest'
import { FX2_KEYS, flashMix, geomCss, kenBurnsZoom, leakSvgUrl } from '@/lib/clips/editor/fx-library'
import { blockState, frameAnim, LAYER_ANIM_TYPES } from '@/lib/clips/render-plan/text-anim'

describe('EFFECTS1b effects', () => {
  it('appends flash / leak / kenburns', () => {
    expect(FX2_KEYS.slice(-3)).toEqual(['flash', 'leak', 'kenburns'])
  })
  it('flash strobes 2 of every 15 export frames', () => {
    expect(flashMix(100, 0)).toBeCloseTo(0.8)
    expect(flashMix(100, 1)).toBeCloseTo(0.8)
    expect(flashMix(100, 2)).toBe(0)
    expect(flashMix(100, 15)).toBeCloseTo(0.8)
  })
  it('ken burns grows 2%/s at 100, capped at 10 s, and joins the geometry transform', () => {
    expect(kenBurnsZoom(100, 0)).toBe(1)
    expect(kenBurnsZoom(100, 300)).toBeCloseTo(1.2)
    expect(kenBurnsZoom(100, 900)).toBeCloseTo(1.2)
    expect(geomCss({ kenburns: 100 }, 320, 568, 0)).toBe('scale(1, 1)')
  })
  it('light leak is an SVG data url', () => {
    expect(leakSvgUrl(60, 320, 568).startsWith('data:image/svg+xml;base64,')).toBe(true)
  })
})

describe('EFFECTS1b text rotate-in', () => {
  it('starts at −90° and is text-only', () => {
    expect(blockState('rotate_in', 0).rot).toBe(-90)
    const f = frameAnim({ in: { type: 'rotate_in', unit: 'block', durMs: 500 } }, 0, 0, 2000, 500, 0)
    expect(f.rot).toBe(-90)
    expect(LAYER_ANIM_TYPES).not.toContain('rotate_in')
  })
})
