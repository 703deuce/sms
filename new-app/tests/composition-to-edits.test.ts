import { describe, expect, it } from 'vitest'
import { clipEditsFromComposition, cutRangesFromDocument } from '@/lib/clips/composition-to-edits'
import { emptyDocument } from '@/lib/clips/script-edl/ops'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

const words: EditorWord[] = [
  { id: 'a:0', index: 0, t0Ms: 0, t1Ms: 500, text: 'one', speakerId: 'spk:0' },
  { id: 'a:1', index: 1, t0Ms: 1000, t1Ms: 1500, text: 'two', speakerId: 'spk:0' },
  { id: 'a:2', index: 2, t0Ms: 2000, t1Ms: 2500, text: 'three', speakerId: 'spk:0' },
]

describe('clipEditsFromComposition', () => {
  it('builds cut ranges for deleted middle word', () => {
    const byId = new Map(words.map((w) => [w.id, w]))
    const doc = emptyDocument(words.map((w) => w.id))
    doc.keptWordIds = ['a:0', 'a:2']
    doc.deletedWordIds = ['a:1']
    const cuts = cutRangesFromDocument(doc, byId, 0, 3000)
    expect(cuts.some(([a, b]) => a <= 1000 && b >= 1500)).toBe(true)
    const edits = clipEditsFromComposition({
      document: doc,
      wordsById: byId,
      rangeStartMs: 0,
      rangeEndMs: 3000,
    })
    expect(edits.cutRanges.length).toBeGreaterThan(0)
    expect(edits.trim).toEqual({ in: 0, out: 3000 })
  })
})
