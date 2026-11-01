import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockResolveWorkspace = vi.fn()
const mockGetRender = vi.fn()
const mockFindClip = vi.fn()
const mockSign = vi.fn()

vi.mock('@/lib/server/workspace', () => ({
  resolveWorkspaceId: () => mockResolveWorkspace(),
}))

vi.mock('@/lib/server/clips/renders', () => ({
  getRenderForWorkspace: (...args: unknown[]) => mockGetRender(...args),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clip: { findUnique: (...args: unknown[]) => mockFindClip(...args) },
    clipJob: { findFirst: vi.fn().mockResolvedValue(null) },
  }),
}))

vi.mock('@/lib/storage', () => ({
  getClipStorage: () => ({}),
}))

vi.mock('@/lib/storage/signed-download-cache', () => ({
  createCachedSignedDownloadUrl: (...args: unknown[]) => mockSign(...args),
}))

describe('GET /api/clips/renders/[id] stems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveWorkspace.mockResolvedValue('ws_1')
    mockFindClip.mockResolvedValue({ title: 'My Clip', startMs: 0, endMs: 1000, edits: {} })
    mockSign.mockImplementation((_storage, key, opts) =>
      Promise.resolve(`https://signed.example/${key}?name=${opts?.downloadFilename ?? ''}`),
    )
  })

  it('includes stemsDownloadUrl when stemsKey is set', async () => {
    mockGetRender.mockResolvedValue({
      id: 'rend_stems',
      clipId: 'clip_1',
      status: 'READY',
      outputKey: 'out/v.mp4',
      stemsKey: 'out/stems.zip',
      filename: 'my-clip.mp4',
      sizeBytes: BigInt(1000),
      error: null,
    })
    const { GET } = await import('@/app/api/clips/renders/[id]/route')
    const res = await GET(new Request('http://localhost/api/clips/renders/rend_stems'), {
      params: Promise.resolve({ id: 'rend_stems' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      data: { stemsDownloadUrl: string | null; stemsFilename: string | null }
    }
    expect(json.data.stemsDownloadUrl).toContain('stems.zip')
    expect(json.data.stemsFilename).toBe('my-clip.stems.zip')
    expect(mockSign).toHaveBeenCalledWith(
      expect.anything(),
      'out/stems.zip',
      expect.objectContaining({ downloadFilename: 'my-clip.stems.zip' }),
    )
  })

  it('omits stems when no stemsKey', async () => {
    mockGetRender.mockResolvedValue({
      id: 'rend_plain',
      clipId: 'clip_1',
      status: 'READY',
      outputKey: 'out/v.mp4',
      stemsKey: null,
      filename: null,
      sizeBytes: null,
      error: null,
    })
    const { GET } = await import('@/app/api/clips/renders/[id]/route')
    const res = await GET(new Request('http://localhost/api/clips/renders/rend_plain'), {
      params: Promise.resolve({ id: 'rend_plain' }),
    })
    const json = (await res.json()) as {
      data: { stemsDownloadUrl: string | null; stemsFilename: string | null }
    }
    expect(json.data.stemsDownloadUrl).toBeNull()
    expect(json.data.stemsFilename).toBeNull()
  })
})
