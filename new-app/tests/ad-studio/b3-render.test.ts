import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  run: { id: 'run_1', workspaceId: 'ws_1', status: 'stitching',
    clipId: 'clip_1', projectId: 'proj_1',
    renderId: null as string | null, renderJobId: null as string | null,
    renderStatus: null as string | null,
    input: { name: 'Product', aspect: '9:16', durationSec: 15 }, errorCode: null as string | null,
  },
  render: { id: 'rnd_1', status: 'QUEUED', outputKey: null as string | null },
  enqueue: vi.fn(async () => ({ render: { id: 'rnd_1' }, jobId: 'job_1' })),
}))

const fakeDb = {
  adStudioRun: {
    async findFirst() { return state.run },
    async updateMany({ where, data }: { where: any; data: any }) {
      if (where.status && where.status !== state.run.status) return { count: 0 }
      if (where.renderStatus === null && state.run.renderStatus !== null) return { count: 0 }
      if (typeof where.renderStatus === 'string' && where.renderStatus !== state.run.renderStatus) return { count: 0 }
      Object.assign(state.run, data)
      return { count: 1 }
    },
  },
  clip: { async findFirst() {
    return { id: 'clip_1', workspaceId: 'ws_1', projectId: 'proj_1',
      title: 'Ad commercial', endMs: 15000, previewKey: null,
      edits: { v: 2, trim: { in: 0, out: 15000 } } }
  } },
  clipRender: { async findFirst() { return state.render } },
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({ getPrisma: () => fakeDb }))
vi.mock('@/lib/server/clips/renders', () => ({ enqueueRenderClip: state.enqueue }))
vi.mock('@/lib/server/clips/project-media', () => ({ registerProjectMedia: vi.fn() }))

import { advanceAdRender } from '@/lib/server/ad-studio/destination'

beforeEach(() => {
  Object.assign(state.run, { status: 'stitching', renderId: null, renderJobId: null, renderStatus: null, errorCode: null })
  Object.assign(state.render, { status: 'QUEUED', outputKey: null })
  state.enqueue.mockClear()
})

describe('Ad Studio B3e one-render handoff', () => {
  it('queues RENDER_CLIP once and only finishes after ready output', async () => {
    await advanceAdRender('ws_1', 'run_1')
    await advanceAdRender('ws_1', 'run_1')
    expect(state.enqueue).toHaveBeenCalledTimes(1)
    expect(state.run.renderId).toBe('rnd_1')
    expect(state.run.status).toBe('stitching')
    state.render.status = 'READY'
    state.render.outputKey = 'ws/ws_1/render.mp4'
    await advanceAdRender('ws_1', 'run_1')
    expect(state.run.status).toBe('done')
    expect(state.enqueue).toHaveBeenCalledTimes(1)
  })
  it('marks a failed render without buying another render', async () => {
    await advanceAdRender('ws_1', 'run_1')
    state.render.status = 'FAILED'
    await advanceAdRender('ws_1', 'run_1')
    expect(state.run.status).toBe('failed')
    expect(state.run.errorCode).toBe('RENDER_ERROR')
    expect(state.enqueue).toHaveBeenCalledTimes(1)
  })
})
