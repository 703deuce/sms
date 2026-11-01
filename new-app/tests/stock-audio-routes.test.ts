import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/workspace', () => ({ resolveWorkspaceId: vi.fn(async () => 'ws') }))
vi.mock('@/lib/server/ai/stock-audio', () => ({
  searchStockAudioServer: vi.fn(async () => ({
    available: false,
    hits: [{ id: 'kenney-pop', title: 'Pop', kind: 'sfx', license: 'cc0', durationS: 1, tags: [], previewUrl: '/api/clips/stock-audio/kenney-pop/file' }],
    presets: [{ id: 'ml-001', title: 't', mood: 'upbeat', genre: 'lo-fi', lengthS: 60, prompt: 'x instrumental, no vocals, clean ending' }],
  })),
}))

describe('stock-audio search route', () => {
  it('returns presets when library unavailable', async () => {
    const { GET } = await import('@/app/api/clips/stock-audio/search/route')
    const res = await GET(new Request('http://local/api?kind=music&q=chill'))
    const body = await res.json()
    expect(body.data.available).toBe(false)
    expect(body.data.presets?.length).toBeGreaterThan(0)
  })
})
