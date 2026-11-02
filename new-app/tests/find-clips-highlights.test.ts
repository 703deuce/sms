import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const findFirst = vi.fn()
const findUnique = vi.fn()
const clipFindMany = vi.fn()

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findMany, findFirst, findUnique },
    clip: { findMany: clipFindMany },
  }),
}))
const getClipStorageForObjectKey = vi.fn(async () => ({
  getJson: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/storage', () => ({ getClipStorageForObjectKey: (...args: unknown[]) => getClipStorageForObjectKey(...args) }))
vi.mock('@/lib/server/clips/find-clips-job', () => ({
  latestFindClips: vi.fn(async () => null),
}))

describe('getFullVideoHighlights find preference', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('prefers newer FIND_CLIPS job', async () => {
    vi.resetModules()
    const { latestFindClips } = await import('@/lib/server/clips/find-clips-job')
    vi.mocked(latestFindClips).mockResolvedValueOnce({
      jobId: 'job_new',
      status: 'DONE',
      createdAt: new Date('2026-01-02'),
      progress: 100,
      picks: [
        {
          clipId: 'fp_job_new_0',
          title: 'A',
          startMs: 0,
          endMs: 1000,
          score: 90,
          reasonTag: 'speech',
          why: null,
          findJobId: 'job_new',
          origin: 'find',
        },
      ],
    } as never)
    findFirst.mockResolvedValue({ id: 'fv1', uploadId: 'up', settings: { fullVideo: true } })
    findMany.mockResolvedValueOnce([
      {
        id: 'clips_proj',
        status: 'READY',
        settings: { v: 2, fromFullVideoProjectId: 'fv1' },
        createdAt: new Date('2026-01-01'),
        transcriptKey: null,
        uploadId: 'up',
        upload: null,
      },
    ])
    const { getFullVideoHighlights } = await import('@/lib/server/clips/clip-highlights')
    const res = await getFullVideoHighlights('ws', 'fv1')
    expect(res?.source).toBe('find')
    expect(res?.picks[0]?.origin).toBe('find')
  })

  it('does not select storageDriver on clipProject (column lives on upload/clip only)', async () => {
    vi.resetModules()
    findFirst.mockResolvedValue({ id: 'fv1', uploadId: 'up', settings: { fullVideo: true } })
    findMany.mockResolvedValueOnce([
      {
        id: 'clips_proj',
        status: 'READY',
        settings: { v: 2, fromFullVideoProjectId: 'fv1', mode: 'auto' },
        createdAt: new Date('2026-01-01'),
        transcriptKey: 'ws/ws/words.json',
        uploadId: 'up',
        upload: { storageDriver: 's3' },
      },
    ])
    clipFindMany.mockResolvedValue([
      {
        id: 'c1',
        title: 'Hit',
        startMs: 0,
        endMs: 1000,
        score: 80,
        reason: 'speech',
        aiMeta: {},
      },
    ])
    const { getFullVideoHighlights } = await import('@/lib/server/clips/clip-highlights')
    await getFullVideoHighlights('ws', 'fv1')
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ storageDriver: expect.anything() }),
      }),
    )
    expect(getClipStorageForObjectKey).toHaveBeenCalledWith('ws/ws/words.json', 's3')
  })
})
