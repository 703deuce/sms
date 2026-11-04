// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useEditorWords } from '@/components/clips/editor/use-editor-words'
import { fetchClipEditorWords } from '@/lib/clips-api'

vi.mock('@/lib/clips-api', () => ({
  fetchClipEditorWords: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const bounds = { clipStartMs: 10_000, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 65_000 }
const trim = { in: 10_000, out: 60_000 }

describe('A1/A2 source-word timing', () => {
  it('does not treat initial source-timed project words before clip start as clip-relative', () => {
    const initialWords = [{ i: 1, w: 'early', s: 5, e: 6 }]
    vi.mocked(fetchClipEditorWords).mockResolvedValue({ words: initialWords, bounds } as never)
    const { result } = renderHook(() => useEditorWords('clip', initialWords, bounds, trim))
    expect(result.current.words[0]?.s).toBe(5)
    expect(result.current.words[0]?.e).toBe(6)
  })

  it('N5 does not fetch or display extended-trim progress for an untouched clip with silent margins', async () => {
    const original = [{ i: 1, w: 'middle', s: 22, e: 23 }]
    const { result } = renderHook(() => useEditorWords('clip', original, bounds, trim))
    expect(result.current.loadingReason).toBeNull()
    expect(result.current.wordsLoading).toBe(false)
    expect(fetchClipEditorWords).not.toHaveBeenCalled()
  })

  it('N5 labels initial transcript recovery differently from an actual extended trim', async () => {
    let resolve!: (value: { words: typeof originalWords; bounds: typeof bounds }) => void
    const originalWords = [{ i: 1, w: 'middle', s: 22, e: 23 }]
    vi.mocked(fetchClipEditorWords).mockImplementationOnce(() => new Promise(r => { resolve = r }) as never)
    const { result } = renderHook(() => useEditorWords('clip', [], bounds, trim))
    await waitFor(() => expect(result.current.loadingReason).toBe('initial'))
    resolve({ words: originalWords, bounds })
    await waitFor(() => expect(result.current.loadingReason).toBeNull())
    expect(result.current.words).toEqual(originalWords)
  })

  it('keeps the server source timeline when the extended-trim fetch completes', async () => {
    const serverWords = [{ i: 1, w: 'early', s: 5, e: 6 }, { i: 2, w: 'middle', s: 44, e: 44.3 }]
    vi.mocked(fetchClipEditorWords).mockResolvedValueOnce({ words: serverWords, bounds } as never)
    const { result } = renderHook(() => useEditorWords('clip', [], bounds, trim))
    await waitFor(() => expect(result.current.words).toHaveLength(2), { timeout: 3000 })
    expect(result.current.words.map((w) => w.s)).toEqual([5, 44])
    expect(fetchClipEditorWords).toHaveBeenCalledWith('clip', trim, undefined)
  })
})
