import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findFirst: mockFindFirst },
    clip: { findMany: mockFindMany },
    clipRender: { findFirst: vi.fn().mockResolvedValue(null), update: mockUpdate },
  }),
}))

vi.mock('@/lib/billing/entitlements', () => ({ can: () => true }))
vi.mock('@/lib/server/clips/export-preview-ready', () => ({
  createReadyRenderFromPreview: vi.fn().mockResolvedValue({ renderId: 'rend_ready' }),
}))
vi.mock('@/lib/server/clips/renders', () => ({
  enqueueRenderClip: vi.fn().mockResolvedValue({ render: { id: 'rend_1' }, reused: false }),
}))
vi.mock('@/lib/clips/export-preview-reuse', () => ({
  canReuseClipPreviewForExport: () => true,
}))

describe('enqueueProjectExportAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindFirst.mockResolvedValue({ id: 'proj_1', workspaceId: 'ws_1' })
    mockFindMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        id: `clip_${i}`,
        projectId: 'proj_1',
        workspaceId: 'ws_1',
        title: `Clip ${i}`,
        startMs: 0,
        endMs: 15_000,
        score: 90 - i,
        previewKey: `key_${i}`,
        edits: {},
      })),
    )
  })

  it('caps batch export at 10 clips with preview keys', async () => {
    const { enqueueProjectExportAll } = await import('@/lib/server/clips/export-batch')
    const result = await enqueueProjectExportAll('ws_1', 'proj_1', {
      aspect: '9:16',
      resolution: '720p',
    })
    expect(result.items.length).toBe(10)
    expect(result.batchId).toMatch(/^xbatch_/)
  })
})
