import { describe, expect, it } from 'vitest'
import {
  deletedEditorWordIds,
  editorWordDeletedByCuts,
  editorWordsForClipFillerReview,
} from '@/lib/clips/editor/filler-review-words'
import type { SourceWord } from '@/lib/clips/source-words'

const words: SourceWord[] = [
  { i: 0, s: 0, e: 0.5, w: 'um' },
  { i: 1, s: 0.5, e: 1.0, w: 'hello' },
]

describe('editorWordsForClipFillerReview', () => {
  it('assigns stable clip-scoped ids', () => {
    const editorWords = editorWordsForClipFillerReview('clip_1', words)
    expect(editorWords[0].id).toBe('clip:clip_1:0')
    expect(editorWords[1].t0Ms).toBe(500)
  })

  it('marks words covered by cut ranges as deleted', () => {
    const editorWords = editorWordsForClipFillerReview('c', words)
    const w = editorWords[0]
    expect(editorWordDeletedByCuts(w, [[0, 400]])).toBe(true)
    const deleted = deletedEditorWordIds(editorWords, [[0, 400]])
    expect(deleted.has(w.id)).toBe(true)
    expect(deleted.has(editorWords[1].id)).toBe(false)
  })
})
