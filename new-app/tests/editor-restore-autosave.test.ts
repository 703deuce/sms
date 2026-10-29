// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = {
  clipStartMs: 1000,
  clipEndMs: 5000,
  trimMinMs: 0,
  trimMaxMs: 10_000,
}

vi.mock('@/lib/clips-api', () => ({
  patchClip: vi.fn(() => Promise.resolve({ updatedAt: new Date().toISOString(), editsSaveVersion: 2 })),
}))

describe('applyRestoredEdits', () => {
  it('replaces edits in one step and clears pending debounced save', async () => {
    vi.useFakeTimers()
    const initial = defaultEdits(bounds)
    const { result } = renderHook(() => useEditorState('clip_test', bounds, initial, {}))

    act(() => {
      result.current.setCaptions({ colors: { a: '#FF0000' } })
    })
    expect(result.current.edits.captions?.colors?.a).toBe('#FF0000')

    const restored: ClipEditsV2 = {
      ...initial,
      captions: { ...initial.captions, colors: { a: '#00FF00' } },
    }

    act(() => {
      result.current.applyRestoredEdits(restored)
    })

    expect(result.current.edits.captions?.colors?.a).toBe('#00FF00')
    expect(result.current.canUndo).toBe(true)

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.edits.captions?.colors?.a).toBe('#00FF00')
    vi.useRealTimers()
  })
})
