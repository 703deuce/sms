import { beforeEach, describe, expect, it, vi } from 'vitest'

const { projectFindMany, projectCreate } = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  projectCreate: vi.fn(),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findMany: projectFindMany, create: projectCreate },
  }),
}))

vi.mock('@/lib/supabase/id', () => ({
  createId: (prefix: string) => `${prefix}_new`,
}))

vi.mock('@/lib/storage', () => ({
  projectWordsKey: (workspaceId: string, projectId: string) => `ws/${workspaceId}/projects/${projectId}/words.json`,
}))

import { ensureFullVideoProjectForUpload } from '@/lib/server/clips/ensure-full-video-project'

const upload = {
  id: 'up_1',
  durationMs: 60_000,
  width: 1920,
  height: 1080,
  filename: 'talk.mp4',
}

const sourceProject = {
  id: 'proj_source',
  title: 'Talk',
  transcriptWords: [{ w: 'hello', s: 0, e: 1, i: 0 }],
  proxyKey: 'proxy.mp4',
  rangeEndMs: 60_000,
}

describe('ensureFullVideoProjectForUpload concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projectFindMany.mockResolvedValue([])
    projectCreate.mockResolvedValue({ id: 'proj_fv_up_1' })
  })

  it('atomically creates one queued project with one nested processing job', async () => {
    const projectId = await ensureFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(projectId).toBe('proj_fv_up_1')
    expect(projectCreate).toHaveBeenCalledTimes(1)
    expect(projectCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      id: 'proj_fv_up_1',
      uploadId: 'up_1',
      status: 'QUEUED',
      stage: 'queued',
      proxyKey: 'proxy.mp4',
      jobs: {
        create: {
          id: 'job_new',
          type: 'PROCESS_PROJECT',
          status: 'QUEUED',
        },
      },
    })
  })

  it('reuses an existing full-video project before attempting a create', async () => {
    projectFindMany.mockResolvedValue([{ id: 'proj_existing', settings: { fullVideo: true } }])
    const projectId = await ensureFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(projectId).toBe('proj_existing')
    expect(projectCreate).not.toHaveBeenCalled()
  })

  it('reuses the concurrent winner after a deterministic-id collision', async () => {
    projectFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'proj_winner', settings: { fullVideo: true } }])
    projectCreate.mockRejectedValueOnce(Object.assign(new Error('duplicate id'), { code: 'P2002' }))

    const projectId = await ensureFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(projectId).toBe('proj_winner')
    expect(projectCreate).toHaveBeenCalledTimes(1)
    expect(projectFindMany).toHaveBeenCalledTimes(2)
  })
})
