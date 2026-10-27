import { describe, expect, it } from 'vitest'
import { clipEditsFromScriptDocument } from '@/lib/clips/script-editor/composition-render-edits'
import { emptyDocument } from '@/lib/clips/script-edl/ops'

describe('clipEditsFromScriptDocument studio sound', () => {
  it('passes studioSound generation into edits.audio', () => {
    const doc = {
      ...emptyDocument(['w1']),
      audioFx: { studioSound: { enabled: true, mix: 0.7, assetId: 'gen_abc' } },
    }
    const edits = clipEditsFromScriptDocument(doc, { trimInMs: 0, trimOutMs: 5000, cutRanges: [] })
    expect(edits.audio?.studioSound?.generationId).toBe('gen_abc')
    expect(edits.audio?.studioSound?.mix).toBe(0.7)
  })
})
