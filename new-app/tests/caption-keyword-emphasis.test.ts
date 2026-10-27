import { describe, expect, it } from 'vitest'
import { autoCaptionEmphasisIndexes } from '@/lib/clips/caption-keyword-emphasis'
import { defaultEdits } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds = { clipStartMs: 0, clipEndMs: 30_000 }

function w(text: string, s: number, i: number): SourceWord {
  return { w: text, s, e: s + 0.4, i }
}

describe('autoCaptionEmphasisIndexes', () => {
  it('picks at most one strong keyword per sentence', () => {
    const words = [
      w('The', 0, 0),
      w('secret', 0.5, 1),
      w('is', 1, 2),
      w('simple.', 1.2, 3),
      w('Revenue', 2, 4),
      w('grew', 2.4, 5),
      w('40%.', 2.8, 6),
    ]
    const edits = defaultEdits(bounds)
    edits.captions.wordsPerLine = 3
    const idx = autoCaptionEmphasisIndexes(words, edits)
    expect(idx).toContain(1)
    expect(idx).toContain(4)
    expect(idx.length).toBeLessThanOrEqual(4)
  })
})
