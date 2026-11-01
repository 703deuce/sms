import { describe, expect, it } from 'vitest'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { editorPreviewCaptionClipWords } from '@/lib/clips/editor-preview-edits'
import { editorEditsReducer } from '@/components/clips/editor/use-editor-state'

const bounds = { clipStartMs: 0, clipEndMs: 10000 }

describe('word fix caption preview', () => {
  it('buildCaptionWords resolves fixes by idx when i is absent', () => {
    const edits: ClipEditsV2 = {
      ...normalizeEdits(defaultEdits(bounds), bounds),
      wordFixes: { '12': 'Cracked' },
    }
    const words = [{ w: 'cracked.', s: 1, e: 1.4, idx: 12 }]
    const caps = buildCaptionWords(words, edits)
    expect(caps[0]?.text).toBe('Cracked')
    const preview = editorPreviewCaptionClipWords(words, edits)
    expect(preview[0]?.w).toBe('Cracked')
  })

  it('setWordFix uses a single pass-labeled undo step', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    let state = {
      edits: base,
      past: [] as ClipEditsV2[],
      pastLabels: [] as (string | undefined)[],
      future: [] as ClipEditsV2[],
      saveState: 'saved' as const,
      producerStrip: null,
    }
    const next = { ...base, wordFixes: { '3': 'Cracked' } }
    state = editorEditsReducer(state, { type: 'pass', edits: next, label: 'Word fix' })
    expect(state.past).toHaveLength(1)
    expect(state.pastLabels).toEqual(['Word fix'])
    expect(state.edits.wordFixes['3']).toBe('Cracked')
  })
})
