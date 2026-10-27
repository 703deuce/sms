import { describe, expect, it } from 'vitest'
import {
  countEnrichedFillers,
  enrichTranscriptWords,
  normalizeToken,
  SCRIPT_FILLER_LEXICON,
} from '@/lib/clips/script-editor/enrich-transcript'
import type { ClipWord } from '@/lib/clips/edits'

function w(text: string, s: number, e: number, i: number): ClipWord {
  return { w: text, s, e, i }
}

describe('enrichTranscriptWords', () => {
  it('flags lexicon fillers', () => {
    const words = [w('hello', 0, 0.4, 0), w('um', 0.5, 0.7, 1), w('world', 0.8, 1.1, 2)]
    const out = enrichTranscriptWords(words)
    expect(out[1].isFiller).toBe(true)
    expect(out[1].fillerKind).toBe('lexicon')
    expect(countEnrichedFillers(out)).toBe(1)
  })

  it('flags repeated tokens', () => {
    const words = [w('the', 0, 0.2, 0), w('the', 0.25, 0.45, 1)]
    const out = enrichTranscriptWords(words)
    expect(out[1].isFiller).toBe(true)
    expect(out[1].fillerKind).toBe('repeat')
  })

  it('marks gap before word when pause exceeds threshold', () => {
    const words = [w('a', 0, 0.3, 0), w('b', 1.2, 1.5, 1)]
    const out = enrichTranscriptWords(words, { gapThresholdMs: 750 })
    expect(out[1].gapBeforeMs).toBeGreaterThanOrEqual(900)
  })

  it('normalizes tokens for lexicon lookup', () => {
    expect(SCRIPT_FILLER_LEXICON.has(normalizeToken('Like,'))).toBe(true)
  })
})
