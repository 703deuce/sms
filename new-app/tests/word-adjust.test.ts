import { describe, expect, it } from 'vitest'
import { applySymmetricGapTrim, symmetricGapTrimMs } from '@/lib/clips/script-edl/word-adjust'
import { applyCompositionOp, emptyDocument } from '@/lib/clips/script-edl/ops'
import { deriveEdl } from '@/lib/clips/script-edl/derive-edl'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

describe('symmetric gap trim', () => {
  it('computes removable silence', () => {
    expect(symmetricGapTrimMs(1500, 300)).toBe(1200)
    expect(symmetricGapTrimMs(200, 300)).toBe(0)
  })

  it('applies head/tail trim on document', () => {
    const doc = emptyDocument(['a', 'b'])
    const next = applySymmetricGapTrim(doc, 'a', 'b', 100)
    expect(next.wordSourceAdjust?.a?.tailTrimMs).toBe(50)
    expect(next.wordSourceAdjust?.b?.headTrimMs).toBe(50)
  })
})

describe('ignore and shorten ops', () => {
  const words: EditorWord[] = [
    { id: 'a', index: 0, t0Ms: 0, t1Ms: 400, text: 'hi', speakerId: 'spk:0' },
    { id: 'b', index: 1, t0Ms: 2000, t1Ms: 2400, text: 'um', speakerId: 'spk:0', isFiller: true },
  ]
  const map = new Map(words.map((w) => [w.id, w]))

  it('ignore_words skips playback', () => {
    let doc = emptyDocument(['a', 'b'])
    doc = applyCompositionOp(doc, { type: 'ignore_words', wordIds: ['b'] })
    const edl = deriveEdl(doc, map, { padMs: 0 })
    expect(edl.filter((s) => s.kind === 'source')).toHaveLength(1)
  })

  it('shorten_gap_before adjusts trims', () => {
    let doc = emptyDocument(['a', 'b'])
    doc = applyCompositionOp(doc, {
      type: 'shorten_gap_before',
      wordId: 'b',
      prevWordId: 'a',
      gapMs: 1600,
      targetGapMs: 300,
    })
    expect(doc.wordSourceAdjust?.b?.headTrimMs).toBeGreaterThan(0)
  })
})
