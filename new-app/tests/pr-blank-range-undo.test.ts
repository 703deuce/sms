import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, pruneVideoSplitsInCutRanges, type ClipEditsV2 } from '@/lib/clips/edits'
import { blankProjectDisplayDurationMs, BLANK_INITIAL_TRIM_MS } from '@/lib/server/clips/projects'
import { deleteRange } from '@/lib/clips/editor/timeline-edit-ops'
import { editorEditsReducer, type State } from '@/components/clips/editor/use-editor-state'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'

const bounds = { clipStartMs: 0, clipEndMs: 32000, trimMinMs: 0, trimMaxMs: 40000 }
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), ...patch })

describe('PR-01 blank project duration label', () => {
  it('uses clip trim span, not legacy 10 min project range', () => {
    const ms = blankProjectDisplayDurationMs(
      { rangeStartMs: 0, rangeEndMs: 600_000 },
      600_000,
      { trim: { in: 0, out: 10_000 } },
    )
    expect(ms).toBe(10_000)
    expect(ms).toBeLessThan(BLANK_INITIAL_TRIM_MS + 1)
  })
})

describe('range delete + videoSplits', () => {
  it('pruneVideoSplitsInCutRanges removes splits inside new cuts', () => {
    expect(pruneVideoSplitsInCutRanges([4641, 29_700], [[4000, 5000]])).toEqual([29_700])
  })

  it('undo restores videoSplits after shift+del range delete', () => {
    const edits = base({ videoSplits: [29_700], cutRanges: [] })
    const preview = editorPreviewEdits(edits, [])
    const ctx = { edits, previewEdits: preview, clampTrim: (t: { in: number; out: number }) => t, sfxDurationsMs: undefined, magnet: true }
    const afterDelete = deleteRange(ctx, [5240, 7220])
    expect(afterDelete).toBeTruthy()
    let state: State = { edits, past: [], future: [], saveState: 'saved', producerStrip: null }
    state = editorEditsReducer(state, { type: 'set', edits: afterDelete!, pushHistory: true })
    expect(state.edits.videoSplits).toEqual([29_700])
    state = editorEditsReducer(state, { type: 'undo' })
    expect(state.edits.videoSplits).toEqual([29_700])
    expect(state.edits.cutRanges).toEqual([])
  })
})
