import { describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const findFirst = vi.fn()
const findUnique = vi.fn()

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findMany, findFirst, findUnique },
    clip: { findMany: vi.fn() },
  }),
}))
vi.mock('@/lib/storage', () => ({ getClipStorageForObjectKey: vi.fn() }))
vi.mock('@/lib/server/clips/find-clips-job', () => ({
  latestFindClips: vi.fn(async () => ({
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
  })),
}))

describe('getFullVideoHighlights find preference', () => {
  it('prefers newer FIND_CLIPS job', async () => {
    findFirst.mockResolvedValue({ id: 'fv1', uploadId: 'up', settings: { fullVideo: true } })
    findMany.mockResolvedValueOnce([
      {
        id: 'clips_proj',
        status: 'READY',
        settings: { fromFullVideoProjectId: 'fv1' },
        createdAt: new Date('2026-01-01'),
        transcriptKey: null,
        storageDriver: null,
        uploadId: 'up',
      },
    ])
    const { getFullVideoHighlights } = await import('@/lib/server/clips/clip-highlights')
    const res = await getFullVideoHighlights('ws', 'fv1')
    expect(res?.source).toBe('find')
    expect(res?.picks[0]?.origin).toBe('find')
  })
})
