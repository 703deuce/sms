// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { defaultEdits, normalizeEdits, type ClipBounds } from '@/lib/clips/edits'
import type { CleanupProposal } from '@/lib/clips/editor/cleanup-proposals'

const bounds: ClipBounds = {
  clipStartMs: 0,
  clipEndMs: 60_000,
  trimMinMs: 0,
  trimMaxMs: 60_000,
}

function fillerProposal(i: number): CleanupProposal {
  const start = 1000 + i * 500
  return {
    id: `f-${start}`,
    kind: 'filler',
    range: [start, start + 80],
    label: `filler ${i}`,
  }
}

function gapProposal(i: number): CleanupProposal {
  const start = 20_000 + i * 400
  return {
    id: `g-${start}`,
    kind: 'gap',
    range: [start, start + 120],
    label: `gap ${i}`,
  }
}

describe('restoreCutRanges (cleanup panel restore-all)', () => {
  it('restores all ranges of one kind in a single undo step and leaves other cuts', () => {
    const initial = normalizeEdits(defaultEdits(bounds), bounds)
    const { result } = renderHook(() => useEditorState('clip_restore_batch', bounds, initial))

    const fillers = Array.from({ length: 15 }, (_, i) => fillerProposal(i))
    const gaps = Array.from({ length: 8 }, (_, i) => gapProposal(i))

    act(() => {
      result.current.applyCleanupCuts(fillers, 'Remove fillers · 15 cuts')
      result.current.applyCleanupCuts(gaps, 'Shorten gaps · 8 cuts')
    })

    expect(result.current.edits.cutRanges?.length).toBe(23)

    act(() => {
      result.current.restoreCutRanges(
        fillers.map((p) => p.range),
        'Restore fillers · 15 cuts',
      )
    })

    expect(result.current.edits.cutRanges?.length).toBe(8)
    expect(result.current.historyPastLabels.at(-1)).toBe('Restore fillers · 15 cuts')

    act(() => {
      result.current.undo()
    })

    expect(result.current.edits.cutRanges?.length).toBe(23)
  })
})
