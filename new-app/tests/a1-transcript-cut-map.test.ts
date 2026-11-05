import { describe, expect, it } from 'vitest'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { transcriptCutForSelection, transcriptWordRemovedFromVideo, wordsSelectedByMidpoint } from '@/lib/clips/editor/transcript-cut-map'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds = { clipStartMs: 40000, clipEndMs: 55000 }
const words: SourceWord[] = [
  { i: 0, s: 40, e: 40.2, w: 'intro' },
  { i: 1, s: 44, e: 44.15, w: 'go' },
  { i: 2, s: 44.16, e: 44.45, w: 'through' },
  { i: 3, s: 46, e: 46.2, w: 'next' },
]

describe('A1 script cut source/output mapping', () => {
  it('does not delete an overlapping but unselected neighbouring word', () => {
    const near: SourceWord[] = [
      { i: 1, s: 40, e: 40.2, w: 'keep' },
      { i: 2, s: 40.15, e: 40.3, w: 'remove' },
      { i: 3, s: 40.31, e: 40.5, w: 'also-keep' },
    ]
    expect(wordsSelectedByMidpoint(near, 40150, 40300).map((w) => w.w)).toEqual(['remove'])
    const edits = defaultEdits({ clipStartMs: 40000, clipEndMs: 40500 })
    expect(transcriptCutForSelection(edits, near, 40150, 40300)?.range).toEqual([40150, 40300])
  })

  it('cuts selected words at the absolute source time, not 0:00 of the clip', () => {
    const edits = defaultEdits(bounds)
    const cut = transcriptCutForSelection(edits, words, 44000, 44450)
    expect(cut?.range).toEqual([44000, 44450])
    expect(cut?.atOutputMs).toBe(4000)
  })

  it('N6 only strikes source words actually absent from the rendered keep segments', () => {
    const base = defaultEdits(bounds)
    const cut: ClipEditsV2 = { ...base, cutRanges: [[44_000, 44_400]] }
    const first = { i: 21, s: 43.8, e: 44.1, w: 'partially' }
    const middle = { i: 22, s: 44.15, e: 44.35, w: 'removed' }
    const last = { i: 23, s: 44.35, e: 44.75, w: 'retained' }
    // The first word overlaps the cut at its trailing edge, but its midpoint is played.
    expect(transcriptWordRemovedFromVideo(cut, first)).toBe(false)
    expect(transcriptWordRemovedFromVideo(cut, middle)).toBe(true)
    expect(transcriptWordRemovedFromVideo(cut, last)).toBe(false)
    // A cut range imported from old data outside the active clip can never strike words.
    expect(transcriptWordRemovedFromVideo({ ...cut, cutRanges: [[4_000, 5_000]] }, middle)).toBe(false)
  })

  it('does not cut words outside trim or already removed ranges', () => {
    const edits = defaultEdits(bounds)
    expect(transcriptCutForSelection(edits, words, 1000, 1500)).toBeNull()
    const alreadyCut: ClipEditsV2 = { ...edits, cutRanges: [[44000, 44450]] }
    expect(transcriptCutForSelection(alreadyCut, words, 44000, 44450)).toBeNull()
  })
})
