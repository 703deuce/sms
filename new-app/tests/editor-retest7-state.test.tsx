// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { patchClip } from '@/lib/clips-api'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

vi.mock('@/lib/clips-api', () => ({ patchClip: vi.fn(), clipsFetch: vi.fn() }))
vi.mock('sonner', () => ({ toast: { message: vi.fn(), error: vi.fn(), success: vi.fn() } }))

const bounds = { clipStartMs: 0, clipEndMs: 31000, trimMinMs: 0, trimMaxMs: 31000 }
const clean = () => normalizeEdits(defaultEdits(bounds), bounds)

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
  vi.mocked(patchClip).mockReset()
  vi.useRealTimers()
})

describe('Retest #7 F38 save and history', () => {
  it('persists the newest undone EDL after an older duplicate save completes', async () => {
    vi.useFakeTimers()
    let completeOlder!: (value: object) => void
    const older = new Promise<object>((resolve) => { completeOlder = resolve })
    const patch = vi.mocked(patchClip)
    patch.mockImplementationOnce(() => older as ReturnType<typeof patchClip>)
    patch.mockImplementation(() => Promise.resolve({ applied: true, editsSaveVersion: 2, updatedAt: '2026-11-05T10:00:01Z' }) as ReturnType<typeof patchClip>)

    const editor = renderHook(() => useEditorState('clip_retest7_latest_undo', bounds, clean()))
    act(() => editor.result.current.setEditsPass(
      { ...editor.result.current.edits, videoSplits: [15000] },
      'Duplicated Video clip',
    ))
    expect(editor.result.current.historyPastLabels.at(-1)).toBe('Duplicated Video clip')
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(patch).toHaveBeenCalledTimes(1)

    act(() => editor.result.current.undo())
    expect(editor.result.current.edits.videoSplits ?? []).toHaveLength(0)
    await act(async () => {
      completeOlder({ applied: true, editsSaveVersion: 1, updatedAt: '2026-11-05T10:00:00Z' })
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(patch.mock.calls.length).toBeGreaterThanOrEqual(2)
    const lastSave = patch.mock.calls.at(-1)?.[1] as { edits?: { videoSplits?: number[] | null }; baseVersion?: number }
    expect(lastSave.edits?.videoSplits ?? []).toHaveLength(0)
    expect(lastSave.baseVersion).toBe(1)
    expect(editor.result.current.historyFutureLabels[0]).toBe('Duplicated Video clip')
  })
})
