import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
const mockProjectFindFirst = vi.fn()
const mockProjectFindMany = vi.fn()
const mockUploadFindFirst = vi.fn()
const mockEnsureFv = vi.fn()
const mockWaitFvClip = vi.fn()

vi.mock('@/lib/server/clips/ensure-full-video-project', () => ({
  findFullVideoProjectForUpload: vi.fn(async () => null),
  ensureFullVideoProjectForUpload: (...args: unknown[]) => mockEnsureFv(...args),
  waitForFullVideoClip: (...args: unknown[]) => mockWaitFvClip(...args),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clip: { findFirst: mockFindFirst },
    clipProject: { findFirst: mockProjectFindFirst, findMany: mockProjectFindMany },
    clipUpload: { findFirst: mockUploadFindFirst },
  }),
}))

const baseProject = {
  id: 'proj_clips',
  title: 'Found clips',
  uploadId: 'up_1',
  transcriptWords: [{ w: 'hi', s: 0, e: 1, i: 0 }],
  proxyKey: null,
  rangeEndMs: 60_000,
}

describe('resolveFullVideoLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadFindFirst.mockResolvedValue({
      id: 'up_1',
      durationMs: 60_000,
      width: 1920,
      height: 1080,
      filename: 'talk.mp4',
    })
    mockProjectFindMany.mockResolvedValue([])
    mockWaitFvClip.mockResolvedValue(null)
    mockEnsureFv.mockResolvedValue('proj_fv_new')
  })

  it('uses settings.fromFullVideoProjectId when present', async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        startMs: 5000,
        endMs: 9000,
        title: 'Test clip',
        project: {
          ...baseProject,
          settings: {
            v: 2,
            mode: 'auto',
            genre: 'auto',
            clipLength: 'auto',
            clipLenMode: 'auto',
            targetClipLenS: null,
            rangeStartMs: 0,
            rangeEndMs: 60_000,
            layout: 'speaker_follow',
            aspectRatio: '9:16',
            fromFullVideoProjectId: 'proj_fv',
          },
        },
      })
      .mockResolvedValueOnce({ id: 'clip_fv', title: 'Full' })
    mockProjectFindFirst.mockResolvedValueOnce({ id: 'proj_fv' })
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const link = await resolveFullVideoLink('ws', 'clip_a')
    expect(link?.projectId).toBe('proj_fv')
    expect(link?.url).toContain('t=5000')
    expect(link?.url).toContain('fromClip=')
    expect(mockEnsureFv).not.toHaveBeenCalled()
  })

  it('creates full-video project on demand when none exists', async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        startMs: 5000,
        endMs: 9000,
        title: 'Test clip',
        project: {
          ...baseProject,
          settings: {
            v: 2,
            mode: 'auto',
            genre: 'auto',
            clipLength: 'auto',
            clipLenMode: 'auto',
            targetClipLenS: null,
            rangeStartMs: 0,
            rangeEndMs: 60_000,
            layout: 'speaker_follow',
            aspectRatio: '9:16',
          },
        },
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'clip_fv_new', title: 'Full' })
    mockWaitFvClip.mockResolvedValueOnce({ id: 'clip_fv_new' })
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const link = await resolveFullVideoLink('ws', 'clip_a')
    expect(mockEnsureFv).toHaveBeenCalledOnce()
    expect(link?.projectId).toBe('proj_fv_new')
    expect(link?.url).toContain('momentIn=5000')
  })
})
