import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { editorEditsReducer } from '@/components/clips/editor/use-editor-state'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

describe('studio sound undo', () => {
  it('undo reverts a single studioSound enable edit', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    let state = {
      edits: base,
      past: [] as ReturnType<typeof normalizeEdits>[],
      pastLabels: [] as (string | undefined)[],
      future: [] as ReturnType<typeof normalizeEdits>[],
      saveState: 'saved' as const,
      producerStrip: null,
    }
    const withStudio = {
      ...base,
      audio: { music: null, sfx: [], studioSound: { enabled: true, generationId: 'gen_1', mix: 0.35 } },
    }
    state = editorEditsReducer(state, { type: 'set', edits: withStudio, pushHistory: true })
    expect(state.edits.audio?.studioSound?.enabled).toBe(true)
    state = editorEditsReducer(state, { type: 'undo' })
    expect(state.edits.audio?.studioSound?.enabled).not.toBe(true)
  })
})
