import { describe, expect, it } from 'vitest'
import { fillerWordCutRanges } from '@/lib/clips/silence-trim'
import { enrichTranscriptWords } from '@/lib/clips/script-editor/enrich-transcript'

describe('SCRIPT_DOC4 fillers', () => {
  it('punctuated fillers are cut', () => {
    const words = [
      { s: 0, e: 0.4, w: 'So' },
      { s: 0.5, e: 0.8, w: 'Um,' },
      { s: 0.9, e: 1.2, w: 'uh.' },
      { s: 1.3, e: 1.7, w: 'Umm' },
      { s: 1.8, e: 2.2, w: 'hello' },
    ]
    expect(fillerWordCutRanges(words).length).toBe(3)
  })
  it('spelling variants get the Clean up filler flag', () => {
    const out = enrichTranscriptWords([
      { w: 'Umm,', s: 0, e: 0.3 },
      { w: 'hmm', s: 0.4, e: 0.6 },
      { w: 'hello', s: 0.7, e: 1 },
    ] as never)
    expect(out.map((w) => Boolean(w.isFiller))).toEqual([true, true, false])
  })
})
