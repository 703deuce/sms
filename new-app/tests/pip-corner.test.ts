import { describe, expect, it } from 'vitest'
import { nearestPipCorner } from '@/lib/clips/headline-preview-style'

describe('pip corner snap', () => {
  it('snaps to nearest corner from pointer', () => {
    const rect = { left: 0, top: 0, width: 100, height: 100 } as DOMRect
    expect(nearestPipCorner(10, 10, rect)).toBe('TL')
    expect(nearestPipCorner(90, 90, rect)).toBe('BR')
  })
})
