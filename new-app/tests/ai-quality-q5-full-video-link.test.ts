import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
const mockProjectFindFirst = vi.fn()

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clip: { findFirst: mockFindFirst },
    clipProject: { findFirst: mockProjectFindFirst },
  }),
}))

describe('resolveFullVideoLink CL-05 moment params', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes fromClip and moment range in url', async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        startMs: 5000,
        endMs: 9000,
        title: 'My moment',
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
      .mockResolvedValueOnce({ id: 'clip_fv', title: 'Full' })
    mockProjectFindFirst.mockResolvedValueOnce({ id: 'proj_fv' })
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const link = await resolveFullVideoLink('ws', 'clip_a')
    expect(link?.url).toContain('fromClip=clip_a')
    expect(link?.url).toContain('momentIn=5000')
    expect(link?.url).toContain('momentOut=9000')
    expect(link?.url).toContain('momentTitle=')
  })
})
