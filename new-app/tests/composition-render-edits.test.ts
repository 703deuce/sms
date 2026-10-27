import { describe, expect, it } from 'vitest'
import { clipEditsFromScriptDocument } from '@/lib/clips/script-editor/composition-render-edits'
import { emptyDocument } from '@/lib/clips/script-edl/ops'

describe('clipEditsFromScriptDocument', () => {
  it('maps broll and captions for worker', () => {
    const doc = emptyDocument(['a:0'])
    doc.settings = { captions: { presetId: 'clean_white' }, aspect: '9:16' }
    doc.broll = [
      {
        id: 'b1',
        source: 'stock',
        assetId: 'stk_1',
        startMs: 1000,
        endMs: 4000,
      },
    ]
    const edits = clipEditsFromScriptDocument(doc, {
      trimInMs: 0,
      trimOutMs: 60_000,
      cutRanges: [],
    })
    expect(edits.broll?.length).toBe(1)
    expect(edits.captions.presetId).toBe('clean_white')
  })
})
