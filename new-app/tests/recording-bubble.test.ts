import { describe, expect, it } from 'vitest'
import { bubbleRect, evenCanvasDims } from '@/lib/clips/editor/recording-bubble'

describe('evenCanvasDims', () => {
  it('caps long side at 1920 and forces even dimensions', () => {
    expect(evenCanvasDims(2560, 1440)).toEqual({ w: 1920, h: 1080 })
    expect(evenCanvasDims(1919, 1079).w % 2).toBe(0)
  })
})

describe('bubbleRect', () => {
  const w = 1920
  const h = 1080

  it('places bubble in each corner with margin', () => {
    const se = bubbleRect(w, h, 'se', 'M')
    expect(se.x + se.d).toBeLessThanOrEqual(w - Math.round(w * 0.025))
    expect(se.y + se.d).toBeLessThanOrEqual(h - Math.round(w * 0.025))
    const nw = bubbleRect(w, h, 'nw', 'M')
    expect(nw.x).toBeGreaterThanOrEqual(Math.round(w * 0.025))
    expect(nw.y).toBeGreaterThanOrEqual(Math.round(w * 0.025))
  })

  it('scales diameter by S/M/L', () => {
    const s = bubbleRect(w, h, 'se', 'S').d
    const m = bubbleRect(w, h, 'se', 'M').d
    const l = bubbleRect(w, h, 'se', 'L').d
    expect(s).toBeLessThan(m)
    expect(m).toBeLessThan(l)
  })
})
