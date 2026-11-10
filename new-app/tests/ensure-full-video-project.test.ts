import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  projectFindMany,
  txProjectFindMany,
  txProjectCreate,
  txJobCreate,
  transaction,
} = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  txProjectFindMany: vi.fn(),
  txProjectCreate: vi.fn(),
  txJobCreate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findMany: projectFindMany },
    $transaction: transaction,
  }),
}))

vi.mock('@/lib/supabase/id', () => ({
  createId: (prefix: string) => prefix === 'proj' ? 'proj_new' : 'job_new',
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

const tx = {
  clipProject: { findMany: txProjectFindMany, create: txProjectCreate },
  clipJob: { create: txJobCreate },
}

describe('ensureFullVideoProjectForUpload concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projectFindMany.mockResolvedValue([])
    txProjectFindMany.mockResolvedValue([])
    txProjectCreate.mockResolvedValue({ id: 'proj_new' })
    txJobCreate.mockResolvedValue({ id: 'job_new' })
    transaction.mockImplementation(async (run: (client: typeof tx) => Promise<string>) => run(tx))
  })

  it('creates one queued project and one processing job inside the transaction', async () => {
    const projectId = await ensureFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(projectId).toBe('proj_new')
    expect(txProjectCreate).toHaveBeenCalledTimes(1)
    expect(txJobCreate).toHaveBeenCalledTimes(1)
    expect(txProjectCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      id: 'proj_new',
      uploadId: 'up_1',
      status: 'QUEUED',
      stage: 'queued',
      proxyKey: 'proxy.mp4',
    })
  })

  it('reuses a concurrent full-video project before creating a duplicate job', async () => {
    txProjectFindMany.mockResolvedValue([{ id: 'proj_existing', settings: { fullVideo: true } }])
    const projectId = await ensureFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(projectId).toBe('proj_existing')
    expect(txProjectCreate).not.toHaveBeenCalled()
    expect(txJobCreate).not.toHaveBeenCalled()
  })

  it('retries one Serializable conflict and reuses the winner', async () => {
    transaction
      .mockRejectedValueOnce(Object.assign(new Error('write conflict'), { code: 'P2034' }))
      .mockImplementationOnce(async (run: (client: typeof tx) => Promise<string>) => run(tx))
    txProjectFindMany.mockResolvedValue([{ id: 'proj_winner', settings: { fullVideo: true } }])

    const projectId = await ensureFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(projectId).toBe('proj_winner')
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(txProjectCreate).not.toHaveBeenCalled()
    expect(txJobCreate).not.toHaveBeenCalled()
  })
})
