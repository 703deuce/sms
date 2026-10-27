import { describe, expect, it } from 'vitest'
import { maxPeopleFound } from '@/components/clips/project-people-strip'
import type { ClipCardData } from '@/components/clips/clip-grid'

function clip(nPersons: number): ClipCardData {
  return {
    id: 'c1',
    title: 'T',
    score: 80,
    durationMs: 15_000,
    startMs: 0,
    endMs: 15_000,
    aiMeta: { nPersons },
  }
}

describe('maxPeopleFound', () => {
  it('returns max nPersons across clips capped at 5', () => {
    expect(maxPeopleFound([clip(2), clip(4)])).toBe(4)
    expect(maxPeopleFound([clip(9)])).toBe(5)
  })

  it('returns 0 when no person metadata', () => {
    expect(maxPeopleFound([{ ...clip(0), aiMeta: {} }])).toBe(0)
  })
})
