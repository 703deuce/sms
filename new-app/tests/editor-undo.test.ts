import { describe, expect, it } from 'vitest'
import { editorEditsReducer } from '@/components/clips/editor/use-editor-state'
import { applyProducerPatch } from '@/lib/clips/edits-reducer'
import { defaultEdits } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('editor undo', () => {
  it('one APPLY_PATCH undo restores size and presetId together', () => {
    const base = defaultEdits(bounds)
    const initial = {
      edits: { ...base, captions: { ...base.captions, presetId: 'bold_pop', size: 1 } },
      past: [] as typeof base[],
      future: [] as typeof base[],
      saveState: 'saved' as const,
      producerStrip: null,
    }
    const { edits: patched } = applyProducerPatch(initial.edits, bounds, [
      { name: 'set_captions', args: { presetId: 'karaoke', animation: 'karaoke', size: 1.2 } },
    ])
    const afterPatch = editorEditsReducer(initial, { type: 'APPLY_PATCH', edits: patched })
    expect(afterPatch.edits.captions?.presetId).toBe('karaoke')
    expect(afterPatch.edits.captions?.size).toBe(1.2)
    expect(afterPatch.past).toHaveLength(1)

    const undone = editorEditsReducer(afterPatch, { type: 'undo' })
    expect(undone.edits.captions?.presetId).toBe('bold_pop')
    expect(undone.edits.captions?.size).toBe(1)
  })

  it('BATCH pushes undo even when edits are unchanged', () => {
    const base = defaultEdits(bounds)
    const initial = {
      edits: base,
      past: [] as typeof base[],
      future: [] as typeof base[],
      saveState: 'saved' as const,
      producerStrip: null,
    }
    const before = { ...base, captions: { ...base.captions, size: 1.05 } }
    const afterBatch = editorEditsReducer(
      { ...initial, edits: before },
      { type: 'BATCH', edits: base, before },
    )
    expect(afterBatch.past).toHaveLength(1)
    const undone = editorEditsReducer(afterBatch, { type: 'undo' })
    expect(undone.past).toHaveLength(0)
  })
})
