import { describe, expect, it } from 'vitest'
import { editorEditsReducer } from '@/components/clips/editor/use-editor-state'
import { defaultEdits } from '@/lib/clips/edits'
import { cleanupPassLabel, singleCleanupApplyLabel } from '@/lib/clips/editor/history-labels'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('editor history pass labels', () => {
  it('pass action stores named label for one undo step', () => {
    const base = defaultEdits(bounds)
    const initial = {
      edits: base,
      past: [] as typeof base[],
      pastLabels: [] as (string | undefined)[],
      future: [] as typeof base[],
      saveState: 'saved' as const,
      producerStrip: null,
    }
    const label = cleanupPassLabel('retake', 3)
    const next = { ...base, cutRanges: [[100, 200] as [number, number]] }
    const after = editorEditsReducer(initial, { type: 'pass', edits: next, label })
    expect(after.pastLabels).toEqual([label])
    const undone = editorEditsReducer(after, { type: 'undo' })
    expect(undone.edits.cutRanges).toEqual([])
    expect(undone.pastLabels).toEqual([])
  })

  it('single retake apply uses Remove retake label', () => {
    expect(singleCleanupApplyLabel({ kind: 'retake' })).toBe('Remove retake')
  })
})
