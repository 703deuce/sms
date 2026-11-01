import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/dev-api-guard', () => ({
  assertDevApiAccess: () => null,
}))

vi.mock('@/lib/server/workspace', () => ({
  resolveWorkspaceId: vi.fn(async () => 'ws_test'),
}))

vi.mock('@/lib/server/clips/speech-search', () => ({
  loadSpeechSources: vi.fn(async () => ({
    sources: [{ id: 'main', kind: 'main', label: 'Main', words: [{ w: 'hi', s: 0, e: 0.2 }] }],
    untranscribed: 2,
  })),
}))

describe('speech-search route', () => {
  it('rejects q shorter than 2 chars', async () => {
    const { GET } = await import('@/app/api/clips/projects/[id]/speech-search/route')
    const res = await GET(new Request('http://local/api?q=a'), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(400)
  })

  it('returns hits and untranscribed', async () => {
    const { GET } = await import('@/app/api/clips/projects/[id]/speech-search/route')
    const res = await GET(new Request('http://local/api?q=hi'), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.untranscribed).toBe(2)
    expect(body.data.hits.length).toBeGreaterThan(0)
  })
})
