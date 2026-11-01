import { describe, expect, it } from 'vitest'
import {
  clampPan,
  fitPercent,
  nextZoom,
  renderScaleFor,
  stageBoxForZoom,
} from '@/lib/clips/editor/preview-view'

describe('CV-12 preview-view', () => {
  it('nextZoom from fit and between steps', () => {
    expect(nextZoom('fit', 1, 38)).toBe(50)
    expect(nextZoom('fit', -1, 38)).toBe(25)
    expect(nextZoom(50, 1, 38)).toBe(75)
    expect(nextZoom(25, -1, 38)).toBe('fit')
    expect(nextZoom(200, 1, 38)).toBe(200)
  })

  it('stageBoxForZoom at 100% 9:16 dpr 2', () => {
    const fit = { w: 270, h: 480 }
    const box = stageBoxForZoom(fit, '9:16', 100, 2)
    expect(box).toEqual({ w: 540, h: 960 })
  })

  it('clampPan', () => {
    expect(clampPan({ x: 100, y: -100 }, { w: 400, h: 400 }, { w: 200, h: 200 })).toEqual({ x: 100, y: -100 })
    expect(clampPan({ x: 500, y: 0 }, { w: 400, h: 200 }, { w: 200, h: 200 }).x).toBe(100)
  })

  it('renderScaleFor auto hysteresis', () => {
    expect(renderScaleFor('full', { boxPx: 3000, dpr: 2, dropRatio: 0, prev: 1 })).toBe(1)
    expect(renderScaleFor('half', { boxPx: 100, dpr: 1, dropRatio: 0, prev: 1 })).toBe(0.5)
    expect(renderScaleFor('auto', { boxPx: 2000, dpr: 2, dropRatio: 0.1, prev: 1 })).toBe(0.5)
    expect(renderScaleFor('auto', { boxPx: 400, dpr: 1, dropRatio: 0, prev: 0.5 })).toBe(1)
  })

  it('fitPercent rounds', () => {
    expect(fitPercent({ w: 270, h: 480 }, '9:16', 2)).toBeGreaterThan(0)
  })
})
