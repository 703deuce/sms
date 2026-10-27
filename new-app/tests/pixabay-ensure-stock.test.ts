import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  stockAsset: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}

const storageMock = {
  getObjectSizeBytes: vi.fn(),
  putBytes: vi.fn(),
  createSignedDownloadUrl: vi.fn(),
}

vi.mock('@/lib/server/db', () => ({ getPrisma: () => prismaMock }))
vi.mock('@/lib/storage', () => ({ getClipStorage: () => storageMock }))

describe('ensureStockAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => '1000' },
        arrayBuffer: async () => new Uint8Array(2000).buffer,
      })),
    )
  })

  it('re-ingests when DB row has storageKey but B2 object is missing', async () => {
    const { ensureStockAsset } = await import('@/lib/server/ai/pixabay')
    prismaMock.stockAsset.findUnique.mockResolvedValue({
      id: 'row1',
      storageKey: 'stock/pixabay/42.mp4',
      provider: 'pixabay',
      providerId: '42',
    })
    storageMock.getObjectSizeBytes.mockResolvedValue(null)
    storageMock.putBytes.mockResolvedValue(undefined)
    storageMock.createSignedDownloadUrl.mockResolvedValue('https://signed.example/v.mp4')
    prismaMock.stockAsset.update.mockResolvedValue({
      id: 'row1',
      storageKey: 'stock/pixabay/42.mp4',
    })

    const hit = {
      providerId: '42',
      pageUrl: 'https://pixabay.com',
      author: 'a',
      authorId: '1',
      tags: 't',
      durationS: 10,
      thumbUrl: '',
      preview: '',
      width: 640,
      height: 360,
      srcUrl: 'https://cdn.pixabay.com/video.mp4',
    }

    const out = await ensureStockAsset(hit)
    expect(storageMock.putBytes).toHaveBeenCalled()
    expect(out.url).toBe('https://signed.example/v.mp4')
  })
})
