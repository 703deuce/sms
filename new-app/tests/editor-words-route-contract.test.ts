import { describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/clips/clips/[id]/editor-words/route'
import { getClipEditorWords } from '@/lib/server/clips/clip-detail'

vi.mock('@/lib/server/clips/clip-detail', () => ({
  getClipEditorWords: vi.fn(),
}))
vi.mock('@/lib/server/workspace', () => ({
  resolveWorkspaceId: vi.fn(async () => 'ws-test'),
}))

describe('A2 editor transcript endpoint contract', () => {
  it('returns words inside the clipsFetch data envelope, preserving source-ms trim arguments', async () => {
    const words = [{ i: 1, w: 'go', s: 44, e: 44.2 }]
    vi.mocked(getClipEditorWords).mockResolvedValueOnce({
      words,
      bounds: { clipStartMs: 0, clipEndMs: 60_000 },
    } as never)
    const res = await GET(
      new Request('http://localhost/api/clips/clips/clip1/editor-words?trimInMs=43000&trimOutMs=45000'),
      { params: Promise.resolve({ id: 'clip1' }) },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { words, bounds: { clipStartMs: 0, clipEndMs: 60_000 } } })
    expect(getClipEditorWords).toHaveBeenCalledWith('ws-test', 'clip1', { trimInMs: 43_000, trimOutMs: 45_000 })
  })

  it('uses server clip bounds when optional query parameters are absent', async () => {
    vi.mocked(getClipEditorWords).mockResolvedValueOnce({
      words: [{ i: 0, w: 'hello', s: 1, e: 1.2 }],
      bounds: { clipStartMs: 0, clipEndMs: 60_000 },
    } as never)
    const res = await GET(
      new Request('http://localhost/api/clips/clips/clip1/editor-words'),
      { params: Promise.resolve({ id: 'clip1' }) },
    )
    expect(res.status).toBe(200)
    expect(getClipEditorWords).toHaveBeenCalledWith('ws-test', 'clip1', undefined)
  })

  it('preserves not-found responses', async () => {
    vi.mocked(getClipEditorWords).mockResolvedValueOnce(null)
    const res = await GET(
      new Request('http://localhost/api/clips/clips/absent/editor-words?trimInMs=0&trimOutMs=1000'),
      { params: Promise.resolve({ id: 'absent' }) },
    )
    expect(res.status).toBe(404)
  })
})
