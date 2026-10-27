import { describe, expect, it } from 'vitest'
import { maxPeopleFound } from '@/components/clips/project-people-strip'
import type { ClipCardData } from '@/components/clips/clip-grid'

describe('maxPeopleFound', () => {
  it('returns max nPersons across clips', () => {
    const clips = [
      { aiMeta: { nPersons: 2 } },
      { aiMeta: { personCount: 4 } },
    ] as ClipCardData[]
    expect(maxPeopleFound(clips)).toBe(4)
  })

  it('returns 0 when no person metadata', () => {
    expect(maxPeopleFound([{ aiMeta: {} }] as ClipCardData[])).toBe(0)
  })
})
