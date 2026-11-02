import { describe, expect, it } from 'vitest'
import { slideEdit } from '@/lib/clips/editor/trim-tools'
import { editorWordDeletedByCuts, editorWordsForClipFillerReview } from '@/lib/clips/editor/filler-review-words'
import { CLIP_5F19E510_BOUNDS, clip5f19e510Edits } from '@/tests/fixtures/clip-5f19e510-edits'
import type { SourceWord } from '@/lib/clips/source-words'

describe('slide clip_5f19e510 transcript cuts', () => {
  const ctx = (e: ReturnType<typeof clip5f19e510Edits>) => ({ edits: e, previewEdits: e })

  it('sliding middle clip right does not mark tail or opening words as cut-deleted', () => {
    const e = clip5f19e510Edits()
    const words: SourceWord[] = [
      { i: 0, w: 'Open', s: 1, e: 1.4 },
      { i: 1, w: 'Smile.', s: 5.0, e: 5.4 },
      { i: 3, w: 'End.', s: 31.5, e: 31.85 },
    ]
    for (const w of words) {
      const row = editorWordsForClipFillerReview('clip_5f19', [w], e, CLIP_5F19E510_BOUNDS)[0]!
      expect(editorWordDeletedByCuts(row, e.cutRanges, e)).toBe(false)
    }

    const s = slideEdit(ctx(e), { lane: 'video', id: 'seg:4641' }, 300)
    expect(s).not.toBeNull()
    expect(s!.transitions).toEqual([{ type: 'spin', durMs: 1000, srcMs: 29_995 }])
    expect(s!.cutRanges).toEqual([[29_515, 29_995]])
    for (const w of words) {
      const row = editorWordsForClipFillerReview('clip_5f19', [w], s!, CLIP_5F19E510_BOUNDS)[0]!
      expect(editorWordDeletedByCuts(row, s!.cutRanges, s!)).toBe(false)
    }
  })
})
