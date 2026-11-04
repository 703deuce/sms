// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

vi.mock('@/lib/clips-api', () => ({ patchClip: vi.fn(() => Promise.resolve({})), clipsFetch: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

const bounds = { clipStartMs: 0, clipEndMs: 10000, trimMinMs: 0, trimMaxMs: 20000 }
const initial = (): ClipEditsV2 => ({
  ...normalizeEdits(defaultEdits(bounds), bounds),
  loopFriendlyEnd: false,
  broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 5000, endMs: 7000 }],
  audio: { music: null, sfx: [{ generationId: 's', atMs: 6000 }] },
})

describe('useEditorState ripple (E2): transcript cuts keep B-roll/SFX on their content', () => {
  it('a cut before the items shifts them left in the SAME undo step', () => {
    const { result } = renderHook(() => useEditorState('clip_ripple_test', bounds, initial()))
    act(() => result.current.setCutRanges([[1000, 2000]]))
    expect(result.current.edits.cutRanges).toEqual([[1000, 2000]])
    expect(result.current.edits.broll![0]).toMatchObject({ startMs: 4000, endMs: 6000 })
    expect(result.current.edits.audio!.sfx[0]!.atMs).toBe(5000)
    act(() => result.current.undo())
    expect(result.current.edits.cutRanges ?? []).toEqual([])
    expect(result.current.edits.broll![0]).toMatchObject({ startMs: 5000, endMs: 7000 })
    expect(result.current.edits.audio!.sfx[0]!.atMs).toBe(6000)
  })
  it('D2 enables Undo immediately for an SFX addition and tracks the same stack as keyboard Undo', () => {
    const { result } = renderHook(() => useEditorState('clip_d2_sfx_history', bounds, initial()))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    act(() => result.current.addSfx({ generationId: 'whoosh', atMs: 2500, volume: 0.8 }))
    expect(result.current.edits.audio?.sfx.some((item) => item.generationId === 'whoosh')).toBe(true)
    expect(result.current.historyPast).toHaveLength(1)
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.undo())
    expect(result.current.edits.audio?.sfx.some((item) => item.generationId === 'whoosh')).toBe(false)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.redo())
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('a timeline commit (setEdits) that only moves an item is not rippled', () => {
    const { result } = renderHook(() => useEditorState('clip_ripple_test2', bounds, initial()))
    const e = result.current.edits
    act(() => result.current.setEdits({ ...e, broll: [{ ...e.broll![0]!, startMs: 5500, endMs: 7500 }] }))
    expect(result.current.edits.broll![0]).toMatchObject({ startMs: 5500, endMs: 7500 })
    expect(result.current.edits.audio!.sfx[0]!.atMs).toBe(6000)
  })
})
