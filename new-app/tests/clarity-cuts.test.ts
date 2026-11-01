import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/server/clips/caption-emojis', () => ({
  loadClipWordsForLlm: vi.fn(),
}))

vi.mock('@/lib/server/ai/openai-json', () => ({
  openAiJsonWithGeminiFallback: vi.fn(),
}))

describe('suggestClarityCuts', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('drops invalid and oversized proposals', async () => {
    const { loadClipWordsForLlm } = await import('@/lib/server/clips/caption-emojis')
    const { openAiJsonWithGeminiFallback } = await import('@/lib/server/ai/openai-json')
    vi.mocked(loadClipWordsForLlm).mockResolvedValue({
      bounds: { clipStartMs: 0, clipEndMs: 10_000 },
      edits: { cutRanges: [], trim: { in: 0, out: 10_000 } } as never,
      inSpan: Array.from({ length: 20 }, (_, i) => ({
        i,
        w: `w${i}`,
        s: i * 0.5,
        e: i * 0.5 + 0.4,
      })),
    })
    vi.mocked(openAiJsonWithGeminiFallback).mockResolvedValue({
      cuts: [
        { from: 0, to: 50, reason: 'filler' },
        { from: 1, to: 2, reason: 'repeat' },
        { from: 5, to: 5, reason: 'false_start' },
      ],
    })
    const { suggestClarityCuts } = await import('@/lib/server/clips/clarity-cuts')
    const { proposals } = await suggestClarityCuts('ws', 'clip')
    expect(proposals.length).toBeLessThanOrEqual(2)
    expect(proposals.every((p) => p.endMs > p.startMs)).toBe(true)
  })

  it('returns empty on model error', async () => {
    const { loadClipWordsForLlm } = await import('@/lib/server/clips/caption-emojis')
    const { openAiJsonWithGeminiFallback } = await import('@/lib/server/ai/openai-json')
    vi.mocked(loadClipWordsForLlm).mockResolvedValue({
      bounds: { clipStartMs: 0, clipEndMs: 5000 },
      edits: { cutRanges: [], trim: { in: 0, out: 5000 } } as never,
      inSpan: [{ i: 0, w: 'hi', s: 0, e: 0.5 }],
    })
    vi.mocked(openAiJsonWithGeminiFallback).mockRejectedValue(new Error('fail'))
    const { suggestClarityCuts } = await import('@/lib/server/clips/clarity-cuts')
    const out = await suggestClarityCuts('ws', 'clip')
    expect(out.proposals).toEqual([])
    expect(out.warning).toBeTruthy()
  })
})
