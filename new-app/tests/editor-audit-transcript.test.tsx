// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useEditorWords } from '@/components/clips/editor/use-editor-words'
import { fetchClipEditorWords } from '@/lib/clips-api'

vi.mock('@/lib/clips-api', () => ({ fetchClipEditorWords: vi.fn() }))
afterEach(() => { cleanup(); vi.mocked(fetchClipEditorWords).mockReset() })
const bounds = { clipStartMs: 0, clipEndMs: 10000, trimMinMs: 0, trimMaxMs: 12000 }
const trim = { in: 0, out: 10000 }
describe('Editor audit: transcript refetch ordering', () => {
  it('does not apply a manual refresh response after a newer transcript arrives', async () => {
    const first = [{ i: 1, w: 'first', s: 1, e: 2 }]
    const newWords = [{ i: 1, w: 'new', s: 1, e: 2 }]
    let resolve!: (value: { words: typeof first; bounds: typeof bounds }) => void
    vi.mocked(fetchClipEditorWords).mockImplementation(() =>
      new Promise((r) => { resolve = r }) as ReturnType<typeof fetchClipEditorWords>)
    const ui = renderHook(({words}) => useEditorWords('clip-refetch', words, bounds, trim), { initialProps: { words: first } })
    let refresh!: Promise<void>
    act(() => { refresh = ui.result.current.reloadWords() })
    await waitFor(() => expect(fetchClipEditorWords).toHaveBeenCalledTimes(1))
    ui.rerender({ words: newWords })
    await act(async () => {
      resolve({ words: [{ i: 1, w: 'stale', s: 1, e: 2 }], bounds })
      await refresh
    })
    expect(ui.result.current.words).toEqual(newWords)
  })
})
