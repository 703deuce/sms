import { describe, expect, it, vi, beforeEach } from 'vitest'
import { formatExportError } from '@/lib/clips/export-error'
import { retryFailedRender } from '@/lib/server/clips/renders'

const prismaMock = {
  clipRender: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  clip: {
    findUnique: vi.fn(),
  },
  clipJob: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => prismaMock,
}))

vi.mock('@/lib/supabase/id', () => ({
  createId: (prefix: string) => `${prefix}_test`,
}))

describe('formatExportError', () => {
  it('maps ffmpeg dumps to a short message with details', () => {
    const raw = 'Command ffmpeg returned non-zero exit status 1\n[out#0] Error'
    const out = formatExportError(raw)
    expect(out.message).toContain('Video processing failed')
    expect(out.details).toBe(raw)
  })
})

describe('retryFailedRender', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns existing queued job when retry is idempotent', async () => {
    prismaMock.clipRender.findFirst.mockResolvedValue({
      id: 'rnd_1',
      status: 'FAILED',
      clipId: 'clip_1',
      editsVersionHash: 'hash1',
    })
    prismaMock.clip.findUnique.mockResolvedValue({ id: 'clip_1', projectId: 'proj_1', previewKey: 'k' })
    prismaMock.clipJob.findMany.mockResolvedValue([
      { id: 'job_existing', payload: { renderId: 'rnd_1' } },
    ])

    const res = await retryFailedRender('ws_1', 'rnd_1')
    expect(res).toEqual({ renderId: 'rnd_1', status: 'QUEUED', jobId: 'job_existing' })
    expect(prismaMock.clipJob.create).not.toHaveBeenCalled()
  })

  it('re-queues the same failed render row', async () => {
    prismaMock.clipJob.findMany.mockResolvedValue([])
    prismaMock.clipRender.findFirst.mockResolvedValue({
      id: 'rnd_1',
      status: 'FAILED',
      clipId: 'clip_1',
      editsVersionHash: 'hash1',
    })
    prismaMock.clip.findUnique.mockResolvedValue({ id: 'clip_1', projectId: 'proj_1', previewKey: 'k' })
    prismaMock.clipRender.update.mockResolvedValue({})
    prismaMock.clipJob.create.mockResolvedValue({})

    const res = await retryFailedRender('ws_1', 'rnd_1')
    expect(res.status).toBe('QUEUED')
    expect(prismaMock.clipRender.update).toHaveBeenCalledWith({
      where: { id: 'rnd_1' },
      data: expect.objectContaining({ status: 'QUEUED', error: null }),
    })
    expect(prismaMock.clipJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'RENDER_CLIP',
        status: 'QUEUED',
        payload: { renderId: 'rnd_1', editsVersionHash: 'hash1' },
      }),
    })
  })
})
