import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai-producer-agent/tools/registry', () => ({
  runTool: vi.fn(),
}))
vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(), redactArgs: (args: unknown) => args,
}))
import { checkEditorialSelections, snapEditorialSelections } from '@/lib/ai-producer-agent/specialists'
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
      { ...approved[0], startMs: 500, endMs: 10500 },
      approved[1],
    ], source, words)).toThrow('cut_inside_word')
    expect(() => checkEditorialSelections([
      approved[0],
      { ...approved[1], startMs: 296_000, endMs: 299_500 },
    ], source, words)).toThrow('no_speech_evidence')
  })

  it('repairs only sub-300ms word-edge errors and then fully revalidates', () => {
    const repaired = snapEditorialSelections([
      { ...approved[0], startMs: 500, endMs: 110_000 },
      approved[1],
    ], source, words)
    expect(repaired[0].startMs).toBe(270)
    expect(repaired[1]).toEqual(approved[1])
    expect(() => snapEditorialSelections([
      { ...approved[0], startMs: 500, endMs: 110_000 },
      { ...approved[1], startMs: 116_000 },
    ], source, words, approved)).toThrow('outside_curated')
    expect(() => snapEditorialSelections([
      { ...approved[0], startMs: -100 },
      approved[1],
    ], source, words)).toThrow('invalid_source')
  })

  it('repairs across overlapping ASR words instead of landing in another word', () => {
    const denseWords: ClipWord[] = [
      { w: 'a', s: 0.3, e: 0.8 },
      { w: 'b', s: 0.7, e: 1.2 },
      ...Array.from({ length: 12 }, (_, i) => ({ w: 'word', s: i + 2, e: i + 2.5 })),
      ...Array.from({ length: 12 }, (_, i) => ({ w: 'word', s: i + 140, e: i + 140.5 })),
    ]
    const approvedDense = [
      { ...approved[0], startMs: 740, endMs: 12_900 },
      { ...approved[1], startMs: 140_000, endMs: 150_000 },
    ]
    const fixed = snapEditorialSelections(approvedDense, source, denseWords)
    expect(fixed[0].startMs).toBe(270)
    expect(checkEditorialSelections(fixed, source, denseWords)).toEqual(fixed)
  })

  it('does not silently move more than 1.5 seconds in uninterrupted dense speech', () => {
    const denseWords: ClipWord[] = Array.from({ length: 80 }, (_, i) => ({
      w: 'word', s: i * 0.1, e: i * 0.1 + 0.14,
    }))
    expect(() => snapEditorialSelections([
      { ...approved[0], startMs: 4000, endMs: 16_000 },
      { ...approved[1], startMs: 140_000, endMs: 150_000 },
    ], source, [...denseWords, ...words.filter((w) => w.s >= 140)])).toThrow('cut_inside_word')
  })

  it('rejects microcuts below three seconds', () => {
    expect(() => checkEditorialSelections([
      { ...approved[0], endMs: 2500 }, approved[1],
    ], source, words)).toThrow('invalid_source')
  })
  it('snaps Dialogue edges rejected by the final 30ms word guard', () => {
    const crowded: ClipWord[] = [
      { w: 'So', s: 300.690, e: 300.930 },
      { w: 'heard', s: 324.680, e: 324.890 },
      { w: 'aspirations', s: 399.780, e: 400.060 },
      { w: 'was', s: 429.280, e: 429.510 },
      ...Array.from({ length: 35 }, (_, i) => ({ w: 'speech', s: 301 + i * 0.65, e: 301.4 + i * 0.65 })),
      ...Array.from({ length: 40 }, (_, i) => ({ w: 'speech', s: 401 + i * 0.65, e: 401.4 + i * 0.65 })),
    ]
    const proposed = [
      { startMs: 300_705, endMs: 324_705, beat: 'setup', reason: 'real dialogue' },
      { startMs: 399_810, endMs: 429_310, beat: 'payoff', reason: 'complete answer' },
    ]
    const windows = [
      { ...proposed[0], startMs: 300_000, endMs: 325_000 },
      { ...proposed[1], startMs: 399_000, endMs: 430_000 },
    ]
    expect(() => checkEditorialSelections(proposed, [300_000, 430_000], crowded, windows)).toThrow('cut_inside_word')
    const repaired = snapEditorialSelections(proposed, [300_000, 430_000], crowded, windows)
    expect(repaired).toHaveLength(2)
    expect(repaired.some((x, i) => x.startMs !== proposed[i]?.startMs || x.endMs !== proposed[i]?.endMs)).toBe(true)
    expect(checkEditorialSelections(repaired, [300_000, 430_000], crowded, windows)).toEqual(repaired)
  })

})
