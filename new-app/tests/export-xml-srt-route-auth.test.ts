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
    const { GET } = await import('@/app/api/clips/clips/[id]/srt/route')
    const res = await GET(new Request('http://local/api'), {
      params: Promise.resolve({ id: mockClip.id }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    const { requireAuthenticatedUser } = await import('@/lib/server/auth/session')
    expect(requireAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('GET export-xml returns 200 application/zip (workspace scope only)', async () => {
    const { GET } = await import('@/app/api/clips/clips/[id]/export-xml/route')
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
