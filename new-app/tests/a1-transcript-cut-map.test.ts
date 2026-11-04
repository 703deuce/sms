import { describe, expect, it } from 'vitest'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { transcriptCutForSelection } from '@/lib/clips/editor/transcript-cut-map'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds = { clipStartMs: 40000, clipEndMs: 55000 }
const words: SourceWord[] = [
  { i: 0, s: 40, e: 40.2, w: 'intro' },
  { i: 1, s: 44, e: 44.15, w: 'go' },
  { i: 2, s: 44.16, e: 44.45, w: 'through' },
  { i: 3, s: 46, e: 46.2, w: 'next' },
]

describe('A1 script cut source/output mapping', () => {
  it('cuts selected words at the absolute source time, not 0:00 of the clip', () => {
    const edits = defaultEdits(bounds)
    const cut = transcriptCutForSelection(edits, words, 44000, 44450)
    expect(cut?.range).toEqual([44000, 44450])
    expect(cut?.atOutputMs).toBe(4000)
  })

  it('does not cut words outside trim or already removed ranges', () => {
    const edits = defaultEdits(bounds)
    expect(transcriptCutForSelection(edits, words, 1000, 1500)).toBeNull()
    const alreadyCut: ClipEditsV2 = { ...edits, cutRanges: [[44000, 44450]] }
    expect(transcriptCutForSelection(alreadyCut, words, 44000, 44450)).toBeNull()
  })
})
