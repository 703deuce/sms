import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()
const mockGetClipEditorWords = vi.fn()
const mockEnqueueRenderClip = vi.fn().mockResolvedValue({ render: { id: 'rend_1' }, reused: false })
const mockCreateReady = vi.fn().mockResolvedValue({ renderId: 'rend_ready' })

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findFirst: mockFindFirst },
    clip: { findMany: mockFindMany, update: mockUpdate },
    clipRender: { findFirst: vi.fn().mockResolvedValue(null), update: mockUpdate },
  }),
}))

vi.mock('@/lib/billing/entitlements', () => ({ can: () => true }))
vi.mock('@/lib/server/clips/export-preview-ready', () => ({
  createReadyRenderFromPreview: (...args: unknown[]) => mockCreateReady(...args),
}))
vi.mock('@/lib/server/clips/renders', () => ({
  enqueueRenderClip: (...args: unknown[]) => mockEnqueueRenderClip(...args),
}))
vi.mock('@/lib/clips/export-preview-reuse', () => ({
  canReuseClipPreviewForExport: () => true,
}))
vi.mock('@/lib/server/clips/clip-detail', () => ({
  mergeEditsPatch: (edits: Record<string, unknown>, patch: Record<string, unknown>) => ({ ...edits, ...patch }),
  getClipEditorWords: (...args: unknown[]) => mockGetClipEditorWords(...args),
}))

function driftedEdits() {
  return {
    captions: { enabled: true, case: 'sentence', wordsPerLine: 2 },
    captionLines: [
      { id: 'a', text: 'Hello', startMs: 400, endMs: 800 },
      { id: 'b', text: 'world', startMs: 900, endMs: 1300 },
      { id: 'c', text: 'later', startMs: 8000, endMs: 8400 },
    ],
  }
}

const driftedWords = [
  { i: 0, w: 'Hello', s: 0.4, e: 0.8 },
  { i: 1, w: 'world', s: 0.9, e: 1.3 },
  { i: 2, w: 'later', s: 5.0, e: 5.4 },
]

describe('enqueueProjectExportAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnqueueRenderClip.mockResolvedValue({ render: { id: 'rend_1' }, reused: false })
    mockCreateReady.mockResolvedValue({ renderId: 'rend_ready' })
    mockFindFirst.mockResolvedValue({ id: 'proj_1', workspaceId: 'ws_1' })
    mockGetClipEditorWords.mockResolvedValue({ words: [], bounds: { clipStartMs: 0, clipEndMs: 15_000 } })
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

  it('blocks the whole batch with CAPTION_SYNC_REQUIRED and enqueues nothing when a clip is drifted', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'clip_drift',
        projectId: 'proj_1',
        workspaceId: 'ws_1',
        title: 'Drifted',
        startMs: 0,
        endMs: 2_000,
        score: 90,
        previewKey: 'key_d',
        edits: driftedEdits(),
      },
    ])
    mockGetClipEditorWords.mockResolvedValue({
      words: driftedWords,
      bounds: { clipStartMs: 0, clipEndMs: 2_000 },
    })
    const { enqueueProjectExportAll } = await import('@/lib/server/clips/export-batch')
    const { CaptionSyncRequiredError } = await import('@/lib/clips/caption-sync-guard')
    await expect(
      enqueueProjectExportAll('ws_1', 'proj_1', { aspect: '9:16', resolution: '720p' }),
    ).rejects.toBeInstanceOf(CaptionSyncRequiredError)
    expect(mockEnqueueRenderClip).not.toHaveBeenCalled()
    expect(mockCreateReady).not.toHaveBeenCalled()
  })

  it('exports the batch when captionSyncAck is true even if cues are drifted', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'clip_drift',
        projectId: 'proj_1',
        workspaceId: 'ws_1',
        title: 'Drifted',
        startMs: 0,
        endMs: 2_000,
        score: 90,
        previewKey: 'key_d',
        edits: driftedEdits(),
      },
    ])
    mockGetClipEditorWords.mockResolvedValue({
      words: driftedWords,
      bounds: { clipStartMs: 0, clipEndMs: 2_000 },
    })
    const { enqueueProjectExportAll } = await import('@/lib/server/clips/export-batch')
    const result = await enqueueProjectExportAll('ws_1', 'proj_1', {
      aspect: '9:16',
      resolution: '720p',
      captionSyncAck: true,
    })
    expect(result.items.length).toBe(1)
    expect(mockCreateReady).toHaveBeenCalled()
  })
})
