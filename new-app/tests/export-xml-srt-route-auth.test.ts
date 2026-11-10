import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockClip = {
  id: 'clip_5f19e510a23241c29190475d4723aa21',
  startMs: 0,
  endMs: 32_000,
  title: 'Slide MC',
  edits: { trim: { in: 0, out: 32_000 }, cutRanges: [] },
  project: { upload: { filename: 'short_apex_32s.mp4' } },
}

vi.mock('@/lib/server/workspace', () => ({
  resolveWorkspaceId: vi.fn(async () => 'ws_test'),
}))

vi.mock('@/lib/server/auth/session', () => ({
  requireAuthenticatedUser: vi.fn(async () => {
    throw new Error('requireAuthenticatedUser must not run on workspace-scoped clip routes')
  }),
  getAuthenticatedUser: vi.fn(async () => null),
}))

vi.mock('@/lib/server/clips/clips', () => ({
  getClipForWorkspace: vi.fn(async (_ws: string, id: string) => (id === mockClip.id ? mockClip : null)),
}))

vi.mock('@/lib/server/clips/transcript', () => ({
  loadClipSourceWords: vi.fn(async () => [{ w: 'Hi', s: 0, e: 1, i: 0 }]),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: vi.fn(() => ({
    clip: {
      findFirst: vi.fn(async () => mockClip),
    },
  })),
}))

vi.mock('@/lib/clips/export-nle-bundle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/clips/export-nle-bundle')>()
  return {
    ...actual,
    zipNleExportFiles: vi.fn(async () => Buffer.from('PK\x03\x04mock-zip')),
  }
})

describe('clip export routes without Supabase session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET srt returns 200 text/plain (workspace scope only)', async () => {
    const { GET } = await import('../app/api/clips/clips/[id]/srt/route')
    const res = await GET(new Request('http://local/api'), {
      params: Promise.resolve({ id: mockClip.id }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const { requireAuthenticatedUser } = await import('@/lib/server/auth/session')
    expect(requireAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('GET vtt returns 200 text/vtt (workspace scope only)', async () => {
    const { GET } = await import('../app/api/clips/clips/[id]/vtt/route')
    const res = await GET(new Request('http://local/api'), {
      params: Promise.resolve({ id: mockClip.id }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/vtt')
    const body = await res.text()
    expect(body.startsWith('WEBVTT')).toBe(true)
    const { requireAuthenticatedUser } = await import('@/lib/server/auth/session')
    expect(requireAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('GET export-xml returns 200 application/zip (workspace scope only)', async () => {
    const { GET } = await import('../app/api/clips/clips/[id]/export-xml/route')
    const res = await GET(new Request('http://local/api'), {
      params: Promise.resolve({ id: mockClip.id }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/zip')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBeGreaterThan(4)
    const { requireAuthenticatedUser } = await import('@/lib/server/auth/session')
    expect(requireAuthenticatedUser).not.toHaveBeenCalled()
  })
})

describe('export-xml caption sync gate', () => {
  it('returns 409 CAPTION_SYNC_REQUIRED when NLE cues are drifted and unacked', async () => {
    const { getPrisma } = await import('@/lib/server/db')
    vi.mocked(getPrisma).mockReturnValue({
      clip: {
        findFirst: vi.fn(async () => ({
          ...mockClip,
          startMs: 0,
          endMs: 2_000,
          edits: {
            captions: { enabled: true, case: 'sentence', wordsPerLine: 2 },
            captionLines: [
              { id: 'a', text: 'Hello', startMs: 400, endMs: 800 },
              { id: 'b', text: 'world', startMs: 900, endMs: 1300 },
              { id: 'c', text: 'later', startMs: 8000, endMs: 8400 },
            ],
          },
        })),
      },
    } as never)
    const { loadClipSourceWords } = await import('@/lib/server/clips/transcript')
    vi.mocked(loadClipSourceWords).mockResolvedValue([
      { i: 0, w: 'Hello', s: 0.4, e: 0.8 },
      { i: 1, w: 'world', s: 0.9, e: 1.3 },
      { i: 2, w: 'later', s: 5.0, e: 5.4 },
    ] as never)

    const { GET, POST } = await import('../app/api/clips/clips/[id]/export-xml/route')
    const blocked = await GET(new Request('http://local/api'), {
      params: Promise.resolve({ id: mockClip.id }),
    })
    expect(blocked.status).toBe(409)
    const body = (await blocked.json()) as { code?: string; data?: { warnings?: unknown[] } }
    expect(body.code).toBe('CAPTION_SYNC_REQUIRED')
    expect((body.data?.warnings ?? []).length).toBeGreaterThan(0)

    const ackedGet = await GET(new Request('http://local/api?captionSyncAck=true'), {
      params: Promise.resolve({ id: mockClip.id }),
    })
    expect(ackedGet.status).toBe(200)

    const ackedPost = await POST(
      new Request('http://local/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captionSyncAck: true }),
      }),
      { params: Promise.resolve({ id: mockClip.id }) },
    )
    expect(ackedPost.status).toBe(200)
  })
})
