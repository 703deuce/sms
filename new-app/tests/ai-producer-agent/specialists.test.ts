import { describe, expect, it } from 'vitest'
import { checkEditorialSelections } from '@/lib/ai-producer-agent/specialists'
import { FILM_EDITING_THEORY, SPECIALIST_ROLES } from '@/lib/ai-producer-agent/film-theory'
import type { ClipWord } from '@/lib/clips/edits'

const words: ClipWord[] = Array.from({ length: 150 }, (_, i) => ({
  w: 'word', s: i * 2 + 0.3, e: i * 2 + 0.8,
}))
const source: [number, number] = [0, 300_000]
const approved = [
  { startMs: 0, endMs: 110_000, beat: 'setup', reason: 'complete topic' },
  { startMs: 140_000, endMs: 290_000, beat: 'payoff', reason: 'complete response' },
]
describe('AI Producer specialist editorial handoff', () => {
  it('defines separate film-trained roles with distinct responsibilities', () => {
    expect(FILM_EDITING_THEORY).toContain('emotion, story, rhythm')
    expect(FILM_EDITING_THEORY).toContain('J/L cuts')
    expect(SPECIALIST_ROLES.story).toContain('paper-edit')
    expect(SPECIALIST_ROLES.footage).toContain('FOOTAGE SELECTOR')
    expect(SPECIALIST_ROLES.dialogue).toContain('DIALOGUE/CUT EDITOR')
    expect(SPECIALIST_ROLES.assembly).toContain('PICTURE EDITOR')
    expect(SPECIALIST_ROLES.qa).toContain('QUALITY CONTROL')
  })

  it('accepts chronological sourced whole-thought footage', () => {
    const actual = checkEditorialSelections(approved, source, words)
    expect(actual).toHaveLength(2)
    expect(actual[0].startMs).toBe(0)
  })

  it('prevents the cutting specialist from adding unapproved footage', () => {
    expect(() => checkEditorialSelections([
      { startMs: 0, endMs: 90_000, beat: 'setup', reason: 'supported' },
      { startMs: 116_000, endMs: 270_000, beat: 'payoff', reason: 'not curated' },
    ], source, words, approved)).toThrow('outside_curated')
  })

  it('rejects missing transcript, reversed cuts, and out-of-source edits', () => {
    expect(() => checkEditorialSelections([
      approved[1], approved[0],
    ], source, words)).toThrow('non_chronological')
    expect(() => checkEditorialSelections([
      { ...approved[0], startMs: -500 },
      approved[1],
    ], source, words)).toThrow('invalid_source')
    expect(() => checkEditorialSelections([
      approved[0], { ...approved[1], endMs: 320_000 },
    ], source, words)).toThrow('invalid_source')
    expect(() => checkEditorialSelections([
      { ...approved[0], startMs: 900, endMs: 3900 },
      approved[1],
    ], source, words)).toThrow('cut_inside_word')
    expect(() => checkEditorialSelections([
      approved[0],
      { ...approved[1], startMs: 296_000, endMs: 299_500 },
    ], source, words)).toThrow('no_speech_evidence')
  })

  it('rejects microcuts below three seconds', () => {
    expect(() => checkEditorialSelections([
      { ...approved[0], endMs: 2500 }, approved[1],
    ], source, words)).toThrow('invalid_source')
  })
})
