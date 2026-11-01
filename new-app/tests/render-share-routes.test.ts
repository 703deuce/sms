import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockUpdateMany = vi.fn()
const mockFindFirst = vi.fn()
const mockGetRender = vi.fn()
const mockResolveWorkspace = vi.fn()
const mockResolveUser = vi.fn()

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipRenderShareLink: {
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      findFirst: mockFindFirst,
    },
  }),
}))

vi.mock('@/lib/server/workspace', () => ({
  resolveWorkspaceId: () => mockResolveWorkspace(),
}))

vi.mock('@/lib/server/clips/clips-auth', () => ({
  resolveClipsActorUserId: () => mockResolveUser(),
}))

vi.mock('@/lib/server/clips/renders', () => ({
  getRenderForWorkspace: (...args: unknown[]) => mockGetRender(...args),
}))

vi.mock('@/lib/server/clips/render-share', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/clips/render-share')>()
  return {
    ...actual,
    getPublicRenderSharePayload: vi.fn(),
  }
})

describe('render share routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveWorkspace.mockResolvedValue('ws_1')
    mockResolveUser.mockResolvedValue('user_1')
    mockGetRender.mockResolvedValue({
      id: 'rend_1',
      status: 'READY',
      outputKey: 'out/key.mp4',
    })
    mockCreate.mockResolvedValue({
      id: 'crs_1',
      renderId: 'rend_1',
      slug: 'abc1234567890ab',
      allowDownload: true,
      expiresAt: null,
      revokedAt: null,
      viewCount: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
  })

  it('POST creates share link for ready render', async () => {
    mockFindFirst.mockResolvedValue(null)
    const { POST } = await import('@/app/api/clips/renders/[renderId]/share/route')
    const res = await POST(
      new Request('http://localhost/api/clips/renders/rend_1/share', {
        method: 'POST',
        body: JSON.stringify({ allowDownload: true }),
      }),
      { params: Promise.resolve({ renderId: 'rend_1' }) },
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { shareUrl: string; accessToken: string } }
    expect(json.data.shareUrl).toContain('/share/renders/')
    expect(json.data.accessToken.length).toBeGreaterThan(10)
    expect(mockCreate).toHaveBeenCalled()
  })

  it('POST returns 404 when render is not ready', async () => {
    mockGetRender.mockResolvedValue(null)
    const { POST } = await import('@/app/api/clips/renders/[renderId]/share/route')
    const res = await POST(
      new Request('http://localhost/api/clips/renders/rend_1/share', {
        method: 'POST',
        body: '{}',
      }),
      { params: Promise.resolve({ renderId: 'rend_1' }) },
    )
    expect(res.status).toBe(404)
  })

  it('DELETE revokes active link', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const { DELETE } = await import('@/app/api/clips/renders/[renderId]/share/route')
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ renderId: 'rend_1' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateMany).toHaveBeenCalled()
  })

  it('public GET returns payload from server helper', async () => {
    const { getPublicRenderSharePayload } = await import('@/lib/server/clips/render-share')
    vi.mocked(getPublicRenderSharePayload).mockResolvedValue({
      title: 'Clip',
      filename: 'clip.mp4',
      format: 'mp4',
      resolution: '1080p',
      aspectRatio: '9:16',
      playbackUrl: 'https://cdn/x.mp4',
      playbackStatus: 'ready',
      allowDownload: true,
      viewCount: 1,
      expiresAt: null,
      sizeBytes: 100,
    })
    const { GET } = await import('@/app/api/public/share/renders/[slug]/route')
    const res = await GET(new Request('http://localhost/api/public/share/renders/slug?t=tok'), {
      params: Promise.resolve({ slug: 'slug' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { title: string } }
    expect(json.data.title).toBe('Clip')
  })
})
