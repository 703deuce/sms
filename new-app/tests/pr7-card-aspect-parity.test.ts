import { describe, expect, it } from 'vitest'
import { clipCardAspectClass } from '@/lib/clips/card-aspect'
import { aspectRatioParts } from '@/lib/clips/export-aspect'

describe('PR7 LG13 card frame aspect matches selected export aspect', () => {
  it.each([
    ['9:16', 'aspect-[9/16]'],
    ['3:4', 'aspect-[3/4]'],
    ['4:5', 'aspect-[4/5]'],
    ['1:1', 'aspect-square'],
    ['4:3', 'aspect-[4/3]'],
    ['16:9', 'aspect-video'],
    ['21:9', 'aspect-[21/9]'],
  ] as const)('%s uses %s', (aspect, expected) => {
    expect(clipCardAspectClass(aspect)).toBe(expected)
    const { aw, ah } = aspectRatioParts(aspect)
    expect(aw).toBeGreaterThan(0)
    expect(ah).toBeGreaterThan(0)
  })
})
