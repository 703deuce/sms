// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { FetchJsonError } from '@/lib/client/fetch-json'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const patchClip = vi.fn()
vi.mock('@/lib/clips-api', () => ({ patchClip: (...a: unknown[]) => patchClip(...a), clipsFetch: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

const bounds = { clipStartMs: 0, clipEndMs: 10000, trimMinMs: 0, trimMaxMs: 20000 }
const base = (): ClipEditsV2 => ({
  ...normalizeEdits(defaultEdits(bounds), bounds),
  exportTemplate: { headlineBar: { enabled: true, text: 'HELLO' } },
})

describe('E6 autosave 409 merge is actually saved (headline toggle persists)', () => {
  it('re-PATCHes the merged edits after a conflict', async () => {
    patchClip.mockReset()
    // Server copy changed underneath (export-headline prefetch wrote suggestedHeadline).
    const server = { ...base(), exportTemplate: { headlineBar: { enabled: true, text: 'HELLO' }, suggestedHeadline: 'Hi' } }
    patchClip
      .mockRejectedValueOnce(
        new FetchJsonError('conflict', {
          status: 409,
          conflictData: { edits: server, updatedAt: '2026-10-31T12:00:01Z', editsSaveVersion: 7 },
        }),
      )
      .mockResolvedValue({ updatedAt: '2026-10-31T12:00:02Z', editsSaveVersion: 8 })
    const { result } = renderHook(() =>
      useEditorState('clip_e6_conflict', bounds, base(), { serverUpdatedAt: '2026-10-31T12:00:00Z', editsSaveVersion: 6 }),
    )
    const e = result.current.edits
    act(() =>
      result.current.setEdits({ ...e, exportTemplate: { ...e.exportTemplate, headlineBar: { enabled: false, text: 'HELLO' } } }),
    )
    await waitFor(() => expect(patchClip).toHaveBeenCalledTimes(2), { timeout: 3000 })
    const second = patchClip.mock.calls[1]![1] as { edits: ClipEditsV2; baseVersion: number }
    expect(second.baseVersion).toBe(7)
    expect(second.edits.exportTemplate?.headlineBar?.enabled).toBe(false)
    expect(second.edits.exportTemplate?.suggestedHeadline).toBe('Hi')
    expect(result.current.edits.exportTemplate?.headlineBar?.enabled).toBe(false)
  })

  it('gives up after repeated conflicts instead of looping forever', async () => {
    patchClip.mockReset()
    patchClip.mockImplementation(() =>
      Promise.reject(new FetchJsonError('conflict', { status: 409, conflictData: { edits: { ...base(), trim: { startMs: 0, endMs: 9000 } } } })),
    )
    const { result } = renderHook(() => useEditorState('clip_e6_conflict2', bounds, base()))
    const e = result.current.edits
    act(() => result.current.setEdits({ ...e, exportTemplate: { headlineBar: { enabled: false, text: 'X' } } }))
    const { toast } = await import('sonner')
    // One save pass ends with an error after the conflict cap (before: unbounded `continue`).
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not save edits'), { timeout: 3000 })
  })
})
