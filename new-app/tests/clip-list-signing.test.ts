import { beforeEach, describe, expect, it, vi } from 'vitest'

const { clipFindMany, signUrl, storageForKey } = vi.hoisted(() => ({
  clipFindMany: vi.fn(),
  signUrl: vi.fn(),
  storageForKey: vi.fn(async () => ({ kind: 'fallback' })),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clip: { findMany: clipFindMany },
  }),
}))

vi.mock('@/lib/storage', () => ({
  getClipStorage: () => ({ kind: 'main' }),
  getClipStorageForObjectKey: (...args: unknown[]) => storageForKey(...args),
}))

vi.mock('@/lib/storage/signed-download-cache', () => ({
  createCachedSignedDownloadUrl: (...args: unknown[]) => signUrl(...args),
}))

import { listProjectClips } from '@/lib/server/clips/clips'

function row(id: string, previewKey: string | null, posterKey: string | null) {
  return {
    id,
    projectId: 'proj_1',
    title: id,
    reason: 'test',
    startMs: 0,
    endMs: 10_000,
    score: 90,
    scores: {},
    favorite: false,
    aiMeta: null,
    edits: {},
    previewKey,
    posterKey,
    sourceSegKey: null,
    sourceSegStartMs: null,
    updatedAt: new Date('2026-11-10T12:00:00Z'),
  }
}

describe('clip list media signing isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clipFindMany.mockResolvedValue([
      row('clip_a', null, 'poster-a.jpg'),
      row('clip_b', 'preview-b.mp4', 'poster-b.jpg'),
    ])
    signUrl.mockImplementation(async (_storage: unknown, key: string) => {
      if (key === 'poster-a.jpg') throw new Error('sign failed')
      return `signed:${key}`
    })
  })

  it('keeps every card when one poster sign fails and uses source fallback for that card', async () => {
    const rows = await listProjectClips('ws_1', 'proj_1', 'score', {
      skipTranscriptEnrichment: true,
      project: {
        settings: {},
        transcriptKey: null,
        proxyKey: 'proxy.mp4',
        rangeStartMs: 0,
        upload: { storageDriver: 's3', key: 'source.mp4' },
      },
    })

    expect(rows).toHaveLength(2)
    expect(rows?.[0]?.posterUrl).toBeNull()
    expect(rows?.[0]?.fallbackSourceUrl).toBe('signed:proxy.mp4')
    expect(rows?.[1]?.previewUrl).toBe('signed:preview-b.mp4')
    expect(rows?.[1]?.posterUrl).toBe('signed:poster-b.jpg')
  })

  it('bounds concurrent row signing instead of starting every card at once', async () => {
    clipFindMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => row(`clip_${i}`, `preview-${i}.mp4`, `poster-${i}.jpg`)),
    )
    let active = 0
    let maxActive = 0
    signUrl.mockImplementation(async (_storage: unknown, key: string) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active -= 1
      return `signed:${key}`
    })

    const rows = await listProjectClips('ws_1', 'proj_1', 'score', {
      skipTranscriptEnrichment: true,
      project: {
        settings: {},
        transcriptKey: null,
        proxyKey: null,
        rangeStartMs: 0,
        upload: { storageDriver: 's3', key: 'source.mp4' },
      },
    })

    expect(rows).toHaveLength(20)
    expect(maxActive).toBeLessThanOrEqual(8)
    expect(maxActive).toBeGreaterThan(1)
  })
})
