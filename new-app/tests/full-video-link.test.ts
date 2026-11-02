import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
const mockProjectFindFirst = vi.fn()

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clip: { findFirst: mockFindFirst },
    clipProject: { findFirst: mockProjectFindFirst },
  }),
}))

describe('resolveFullVideoLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses settings.fromFullVideoProjectId when present', async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        startMs: 5000,
        endMs: 9000,
        title: 'Test clip',
        project: {
          uploadId: 'up_1',
          settings: {
            v: 2,
            mode: 'auto',
            genre: 'auto',
            clipLength: 'auto',
            clipLenMode: 'auto',
            targetClipLenS: null,
            rangeStartMs: 0,
            rangeEndMs: 0,
            layout: 'speaker_follow',
            aspectRatio: '9:16',
            fromFullVideoProjectId: 'proj_fv',
          },
        },
      })
      .mockResolvedValueOnce({ id: 'clip_fv' })
    mockProjectFindFirst.mockResolvedValueOnce({ id: 'proj_fv' })
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const link = await resolveFullVideoLink('ws', 'clip_a')
    expect(link?.projectId).toBe('proj_fv')
    expect(link?.url).toContain('t=5000')
    expect(link?.url).toContain('fromClip=')
  })
})
