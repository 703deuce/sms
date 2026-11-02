import { describe, expect, it, vi, beforeEach } from 'vitest'

const clipJobFindFirst = vi.fn()
const clipJobCreate = vi.fn()
const clipProjectFindFirst = vi.fn()
const clipUploadFindFirst = vi.fn()

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipJob: { findFirst: clipJobFindFirst, create: clipJobCreate },
    clipProject: { findFirst: clipProjectFindFirst },
    clipUpload: { findFirst: clipUploadFindFirst },
  }),
}))

vi.mock('@/lib/supabase/id', () => ({ createId: (p: string) => `${p}_new` }))

const fvSettings = {
  fullVideo: true,
  v: 2,
  mode: 'auto',
  genre: 'auto',
  clipLength: 'auto',
  clipLenMode: 'auto',
  targetClipLenS: null,
  rangeStartMs: 0,
  rangeEndMs: 1000,
  layout: 'speaker_follow',
  aspectRatio: '9:16',
  autoZoom: false,
}

describe('queueFindClipsJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is idempotent for active jobs', async () => {
    clipProjectFindFirst.mockResolvedValue({
      id: 'fv1',
      settings: fvSettings,
      uploadId: 'up1',
      rangeEndMs: 1000,
    })
    clipUploadFindFirst.mockResolvedValue({ id: 'up1', durationMs: 1000 })
    clipJobFindFirst.mockResolvedValueOnce({ id: 'job_existing', status: 'RUNNING' })

    const { queueFindClipsJob } = await import('@/lib/server/clips/find-clips-job')
    const res = await queueFindClipsJob('ws', 'fv1')
    expect(res).toEqual({ jobId: 'job_existing', status: 'RUNNING' })
    expect(clipJobCreate).not.toHaveBeenCalled()
  })

  it('payload has findOnly and no byo/fullVideo', async () => {
    clipProjectFindFirst.mockResolvedValue({
      id: 'fv1',
      settings: fvSettings,
      uploadId: 'up1',
      rangeEndMs: 1000,
    })
    clipUploadFindFirst.mockResolvedValue({ id: 'up1', durationMs: 1000 })
    clipJobFindFirst.mockResolvedValueOnce(null)
    clipJobCreate.mockImplementation(async ({ data }) => data)

    const { queueFindClipsJob } = await import('@/lib/server/clips/find-clips-job')
    await queueFindClipsJob('ws', 'fv1')
    const payload = clipJobCreate.mock.calls[0][0].data.payload as Record<string, unknown>
    expect(payload.findOnly).toBe(true)
    expect(payload.byo).toBeUndefined()
    expect(payload.fullVideo).toBeUndefined()
    expect(payload.settingsOverride).toBeTruthy()
  })
})
