import { describe, expect, it } from 'vitest'
import { clipSpokenFirstLine } from '@/lib/clips/clip-spoken-line'
import type { SourceWord } from '@/lib/clips/source-words'

describe('Q3.3 clip spoken first line', () => {
  const words: SourceWord[] = [
    { w: 'Hey', s: 0, e: 0.2, i: 0 },
    { w: 'everyone,', s: 0.2, e: 0.5, i: 1 },
    { w: 'welcome', s: 0.5, e: 0.9, i: 2 },
    { w: 'back.', s: 0.9, e: 1.2, i: 3 },
  ]

  it('returns the first sentence fragment in range', () => {
    expect(clipSpokenFirstLine(words, 0, 1200)).toBe('Hey everyone, welcome back.')
  })
})
