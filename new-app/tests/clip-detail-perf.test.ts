import { describe, expect, it, vi, beforeEach } from 'vitest'

const getClipForWorkspace = vi.fn()
const findUnique = vi.fn()
const streamVodFind = vi.fn()
const resolveEditorWords = vi.fn()
const resolveBrollMedia = vi.fn()
const resolveEditorAssets = vi.fn()
const clipBoundsForPatch = vi.fn()
const createCachedSignedDownloadUrl = vi.fn()
const getObjectSizeBytes = vi.fn()
const getJson = vi.fn()

vi.mock('@/lib/server/clips/clips', () => ({ getClipForWorkspace }))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findUnique },
    streamVod: { findUnique: streamVodFind },
  }),
}))
vi.mock('@/lib/storage', () => ({
  getClipStorage: () => ({ name: 's3', getJson, getObjectSizeBytes }),
  getClipStorageForObjectKey: vi.fn(async () => ({ name: 's3', getJson, getObjectSizeBytes })),
}))
vi.mock('@/lib/storage/signed-download-cache', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/storage/signed-download-cache')>()
  return { ...orig, createCachedSignedDownloadUrl }
})
vi.mock('@/lib/server/clips/editor-words', () => ({
  normalizeTranscriptJson: (x: unknown) => x,
  resolveEditorWords,
}))
vi.mock('@/lib/server/clips/broll-media', () => ({ resolveBrollMedia }))
vi.mock('@/lib/server/clips/editor-assets', () => ({ resolveEditorAssets }))
vi.mock('@/lib/clips/edits', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/clips/edits')>()
  return {
    ...orig,
    normalizeEdits: (raw: unknown, bounds: Parameters<typeof orig.normalizeEdits>[1]) => {
      const base = orig.normalizeEdits(raw, bounds)
      if (Array.isArray((raw as { broll?: unknown })?.broll)) {
        return {
          ...base,
          broll: [{ id: 'b1', source: 'stock' as const, assetId: 'a1', startMs: 0, endMs: 500 }],
        }
      }
      return base
    },
  }
})
vi.mock('@/lib/server/clips/clip-patch-bounds', () => ({ clipBoundsForPatch }))
vi.mock('@/lib/server/clips/clipper-capabilities', () => ({ clipperCapabilities: () => ({}) }))

describe('PERF-2 getClipEditorPayload', () => {
  const clipUpdated = new Date('2026-01-01T00:00:00.000Z')
  const projectUpdated = new Date('2026-01-02T00:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    getClipForWorkspace.mockResolvedValue({
      id: 'clip_1',
      projectId: 'proj_1',
      workspaceId: 'ws',
      title: 't',
      startMs: 0,
      endMs: 1000,
      score: 1,
      updatedAt: clipUpdated,
      editsSaveVersion: 1,
      edits: { v: 2, broll: [{ id: 'b1', source: 'stock', assetId: 'a1', startMs: 0, endMs: 1000 }] },
      previewKey: 'p.mp4',
      posterKey: null,
      cropKey: null,
      sourceSegKey: null,
      sourceSegStartMs: null,
      sourceSegEndMs: null,
      storageDriver: null,
      aiMeta: null,
    })
    findUnique.mockResolvedValue({
      id: 'proj_1',
      title: 'P',
      settings: {},
      status: 'READY',
      transcriptKey: null,
      proxyKey: null,
      updatedAt: projectUpdated,
      upload: { key: 'src.mp4', storageDriver: 's3' },
    })
    clipBoundsForPatch.mockResolvedValue({ trimMinMs: 0, trimMaxMs: 1000 })
    getJson.mockResolvedValue(null)
    getObjectSizeBytes.mockResolvedValue(null)
    streamVodFind.mockResolvedValue(null)
    resolveEditorWords.mockResolvedValue([])
    resolveBrollMedia.mockResolvedValue([])
    resolveEditorAssets.mockResolvedValue({ fullVideo: null, peaksUrl: null, filmstrip: null })
    createCachedSignedDownloadUrl.mockImplementation(async (_s, key, opts) => {
      return `https://signed/${key}?v=${opts?.versionHint ?? 'head'}`
    })
  })

  it('passes versionHint and skips objectVersionToken paths', async () => {
    const { getClipEditorPayload } = await import('@/lib/server/clips/clip-detail')
    await getClipEditorPayload('ws', 'clip_1')
    expect(createCachedSignedDownloadUrl).toHaveBeenCalled()
    for (const call of createCachedSignedDownloadUrl.mock.calls) {
      const opts = call[2] as { versionHint?: string } | undefined
      expect(opts?.versionHint).toBeTruthy()
    }
    expect(getObjectSizeBytes).not.toHaveBeenCalled()
  })

  it('runs resolveEditorWords and resolveEditorAssets concurrently', async () => {
    const order: string[] = []
    const gate = { open: false }
    const track = (name: string) => {
      order.push(`${name}:start`)
      return new Promise<void>((resolve) => {
        const tick = () => {
          if (gate.open) {
            order.push(`${name}:after`)
            resolve()
          } else setTimeout(tick, 0)
        }
        tick()
      })
    }

    clipBoundsForPatch.mockImplementation(() => track('bounds').then(() => ({ trimMinMs: 0, trimMaxMs: 1000 })))
    resolveEditorWords.mockImplementation(() => track('words').then(() => []))
    resolveBrollMedia.mockImplementation(() => track('broll').then(() => []))
    resolveEditorAssets.mockImplementation(() =>
      track('assets').then(() => ({ fullVideo: null, peaksUrl: null, filmstrip: null })),
    )

    const { getClipEditorPayload } = await import('@/lib/server/clips/clip-detail')
    const run = getClipEditorPayload('ws', 'clip_1')
    await new Promise((r) => setTimeout(r, 5))
    gate.open = true
    await run

    const wordsStart = order.indexOf('words:start')
    const assetsStart = order.indexOf('assets:start')
    expect(wordsStart).toBeGreaterThanOrEqual(0)
    expect(assetsStart).toBeGreaterThanOrEqual(0)
    const firstFinish = Math.min(order.indexOf('words:after'), order.indexOf('assets:after'))
    expect(wordsStart).toBeLessThan(firstFinish)
    expect(assetsStart).toBeLessThan(firstFinish)
  })
})
