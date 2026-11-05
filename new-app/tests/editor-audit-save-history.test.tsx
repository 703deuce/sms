// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { patchClip } from '@/lib/clips-api'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { insertCopiedMainVideo } from '@/lib/clips/editor/timeline-edit-ops'

vi.mock('@/lib/clips-api', () => ({ patchClip: vi.fn(), clipsFetch: vi.fn() }))
vi.mock('sonner', () => ({ toast: { message: vi.fn(), error: vi.fn(), success: vi.fn() } }))
const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 20000 }
const clean = () => normalizeEdits(defaultEdits(bounds), bounds)
afterEach(() => {
  cleanup(); localStorage.clear(); sessionStorage.clear()
  vi.mocked(patchClip).mockReset()
})
describe('Editor audit: saved history and export synchronization', () => {
  it('does not restore Undo history for a different sectionOrder EDL', () => {
    const previous = insertCopiedMainVideo(clean(), 20000, [{srcInMs:0,srcOutMs:20000}])!
    localStorage.setItem('transovo:editor-history:v1:changed-edl', JSON.stringify({
      edits: previous, past: [clean()], future: [], pastLabels: ['Duplicate'], futureLabels: [],
    }))
    const ui = renderHook(() => useEditorState('changed-edl', bounds, clean()))
    expect(ui.result.current.canUndo).toBe(false)
    expect(ui.result.current.edits.sectionOrder).toEqual(clean().sectionOrder)
  })

  it('waits for in-flight PATCH before allowing export to continue', async () => {
    let complete!: (value: { applied: boolean; editsSaveVersion: number; updatedAt: string }) => void
    vi.mocked(patchClip).mockImplementationOnce(() => new Promise((resolve) => {
      complete = resolve
    }) as ReturnType<typeof patchClip>)
    const ui = renderHook(() => useEditorState('export-saving', bounds, clean()))
    act(() => ui.result.current.setEdits({ ...ui.result.current.edits, speed: 1.2 }))
    await waitFor(() => expect(patchClip).toHaveBeenCalledTimes(1))
    let finished = false
    const flushing = ui.result.current.flushSave().then(() => { finished = true })
    await Promise.resolve()
    expect(finished).toBe(false)
    await act(async () => {
      complete({ applied: true, editsSaveVersion: 1, updatedAt: '2026-11-05T12:00:00Z' })
      await flushing
    })
    expect(finished).toBe(true)
    expect(ui.result.current.saveState).toBe('saved')
  })
})
