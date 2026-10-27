import { describe, expect, it } from 'vitest'
import { durationMsFromAlignment, wordsFromAlignment } from '@/lib/server/t2v/tts-alignment'

describe('wordsFromAlignment', () => {
  it('matches worker slot ids (slot 3 → 30000, 30001)', () => {
    const al = {
      characters: ['H', 'i', ' ', 't', 'h', 'e', 'r', 'e'],
      character_start_times_seconds: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35],
      character_end_times_seconds: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4],
    }
    const words = wordsFromAlignment(al, { offsetS: 2.0, sceneSlot: 3 })
    expect(words.map((w) => w.i)).toEqual([30000, 30001])
    expect(words[0].s).toBe(2)
    expect(words[1].w).toBe('there')
  })

  it('durationMsFromAlignment uses last character end', () => {
    const al = {
      characters: ['a'],
      character_start_times_seconds: [0],
      character_end_times_seconds: [1.234],
    }
    expect(durationMsFromAlignment(al)).toBe(1234)
  })
})
