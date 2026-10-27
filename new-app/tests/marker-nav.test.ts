import { describe, expect, it } from 'vitest'
import { nextMarkerOutMs, prevMarkerOutMs } from '@/lib/clips/script-editor/marker-nav'

describe('marker-nav', () => {
  const markers = [
    { id: 'a', outMs: 1000 },
    { id: 'b', outMs: 5000 },
    { id: 'c', outMs: 9000 },
  ]

  it('finds next and previous marker', () => {
    expect(nextMarkerOutMs(markers, 1200)).toBe(5000)
    expect(prevMarkerOutMs(markers, 6000)).toBe(5000)
  })
})
