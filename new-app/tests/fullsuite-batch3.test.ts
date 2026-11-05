import { describe, expect, it } from 'vitest'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { editorEditsReducer } from '@/components/clips/editor/use-editor-state'
import { describeEditsChange } from '@/lib/clips/editor/history-labels'

const original = () => defaultEdits({ clipStartMs: 0, clipEndMs: 31_000 })

describe('Full editor suite Batch 3 — history and UI (F6/F12/F13)', () => {
  it('reconstructs the reducer undo and redo stacks after reload, without resetting edits', () => {
    const a = original()
    const b: ClipEditsV2 = { ...a, aspectRatio: '16:9' }
    const baseline: Parameters<typeof editorEditsReducer>[0] = {
      edits: b, past: [], pastLabels: [], future: [], futureLabels: [],
      saveState: 'saved', producerStrip: null,
    }
    const restored = editorEditsReducer(baseline, {
      type: 'restoreHistory', past: [a], pastLabels: ['Changed aspect to 16:9'],
      future: [], futureLabels: [],
    })
    expect(restored.edits).toEqual(b)
    expect(restored.past).toHaveLength(1)
    const undone = editorEditsReducer(restored, { type: 'undo' })
    expect(undone.edits).toEqual(a)
    expect(undone.future).toHaveLength(1)
    expect(editorEditsReducer(undone, { type: 'redo' }).edits).toEqual(b)
  })

  it('split + aspect changes do not masquerade as a layout switch', () => {
    const a = original()
    const next: ClipEditsV2 = {
      ...a, videoSplits: [13_010], aspectRatio: '16:9',
      layout: { ...a.layout, mode: 'full_frame' },
    }
    expect(describeEditsChange(a, next)).toBe('Split Video clip')
    expect(describeEditsChange(a, { ...a, aspectRatio: '16:9' })).toBe('Changed aspect to 16:9')
  })
})
