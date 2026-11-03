import { describe, expect, it } from 'vitest'
import { captionDragBoxStyle, captionDragDelta, rectChanged } from '@/lib/clips/editor/caption-drag-rect'

describe('FIX2 R3 caption drag geometry', () => {
  it('dragging down lowers capY, dragging right raises capX', () => {
    const d = captionDragDelta(36, 64, 360, 640)
    expect(d.dCapX).toBeCloseTo(10)
    expect(d.dCapY).toBeCloseTo(-10)
  })
  it('dragging up raises capY', () => {
    expect(captionDragDelta(0, -32, 360, 640).dCapY).toBeCloseTo(5)
  })
  it('no movement -> exact zero (not -0)', () => {
    const d = captionDragDelta(0, 0, 360, 640)
    expect(Object.is(d.dCapX, 0)).toBe(true)
    expect(Object.is(d.dCapY, 0)).toBe(true)
  })
  it('box style is caption rect relative to frame, padded', () => {
    expect(captionDragBoxStyle({ left: 150, top: 500, width: 200, height: 40 }, { left: 100, top: 100 })).toEqual({
      left: 46,
      top: 396,
      width: 208,
      height: 48,
    })
  })
  it('rectChanged ignores sub-pixel jitter but sees moves and (dis)appearance', () => {
    const a = { left: 10, top: 10, width: 100, height: 20 }
    expect(rectChanged(a, { ...a, left: 10.3 })).toBe(false)
    expect(rectChanged(a, { ...a, top: 12 })).toBe(true)
    expect(rectChanged(null, a)).toBe(true)
    expect(rectChanged(a, null)).toBe(true)
    expect(rectChanged(null, null)).toBe(false)
  })
})
