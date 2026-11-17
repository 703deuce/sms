import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  selected: true,
  job: {} as Record<string, any>,
  query: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    motionStudioAgentJob: {
      findUnique: async () => state.job,
      update: state.update, updateMany: state.updateMany, count: state.count,
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      $queryRaw: state.query, motionStudioAgentJob: { update: state.update, count: state.count },
    }),
  }),
}))
import { claimProducerJob, updateProducerLease } from '../../lib/server/motion-studio/producer-queue'
const request = () => new Request('https://transovo.ai/api/motion-studio/agent/queue/claim',
  { method: 'POST', headers: { Authorization: 'Bearer ' + 'z'.repeat(44) } })
beforeEach(() => {
  process.env.MOTION_STUDIO_PULL_QUEUE = '1'
  process.env.MOTION_STUDIO_PRODUCER_QUEUE_KEY = 'z'.repeat(44)
  process.env.MOTION_STUDIO_AGENT_PUBLIC_URL = 'https://transovo.ai'
  state.selected = true
  state.job = { id: 'msaj_123e4567-e89b-12d3-a456-426614174000', workspaceId: 'ws_a',
    projectId: 'msp_a', userId: 'user_a', parentJobId: null, revision: 0,
    leaseOwner: null, leaseIdHash: null, leaseExpiresAt: null, status: 'queued' }
  state.query.mockReset().mockImplementation(async () => state.selected ? [{ ...state.job }] : [])
  state.update.mockReset().mockImplementation(async ({ data }: any) => {
    Object.assign(state.job, data, { leaseAttempts: 1 })
    return state.job
  })
  state.updateMany.mockReset().mockResolvedValue({ count: 1 })
  state.count.mockReset().mockResolvedValue(0)
})
afterEach(() => {
  delete process.env.MOTION_STUDIO_PULL_QUEUE
  delete process.env.MOTION_STUDIO_PRODUCER_QUEUE_KEY
  delete process.env.MOTION_STUDIO_AGENT_PUBLIC_URL
})
describe('pull worker queue', () => {
  it('claims a durable job and returns scoped worker credentials', async () => {
    const result = await claimProducerJob(request(), { workerId: 'producer-1' })
    expect(result.job).toMatchObject({
      jobId: state.job.id, workspaceId: 'ws_a', projectId: 'msp_a',
      workerId: 'producer-1', jobUrl: 'https://transovo.ai/api/motion-studio/agent/jobs/' + state.job.id,
    })
    expect(result.job!.jobToken).toBeTruthy()
    expect(result.job!.leaseId).toBeTruthy()
    expect(state.job.tokenHash).not.toContain(result.job!.jobToken)
    const sql = state.query.mock.calls[0]?.[0]?.join('') || ''
    expect(sql).toContain("timezone('UTC', CURRENT_TIMESTAMP)")
  })
  it('does not hand out a second concurrent job from the same workspace', async () => {
    state.count.mockResolvedValueOnce(1)
    const response = await claimProducerJob(request(), { workerId: 'producer-2' })
    expect(response).toEqual({ job: null })
    expect(state.update).not.toHaveBeenCalled()
  })
  it('extends an active lease with a heartbeat without rotating its token', async () => {
    const claimed = await claimProducerJob(request(), { workerId: 'producer-1' })
    const heartbeat = await updateProducerLease(request(), {
      action: 'heartbeat', jobId: state.job.id, workerId: 'producer-1', leaseId: claimed.job!.leaseId,
    })
    expect(heartbeat.action).toBe('heartbeat')
    expect(heartbeat.jobToken).toBeUndefined()
  })
  it('renews an active lease and rotates an expired job token without client login', async () => {
    const claimed = await claimProducerJob(request(), { workerId: 'producer-1' })
    const renewed = await updateProducerLease(request(), {
      action: 'renew', jobId: state.job.id, workerId: 'producer-1', leaseId: claimed.job!.leaseId,
    })
    expect(renewed.jobToken).toBeTruthy()
    expect(renewed.jobToken).not.toBe(claimed.job!.jobToken)
  })
  it('rejects another worker or an expired lease and does not issue a token', async () => {
    const claimed = await claimProducerJob(request(), { workerId: 'producer-1' })
    await expect(updateProducerLease(request(), {
      action: 'renew', jobId: state.job.id, workerId: 'producer-2', leaseId: claimed.job!.leaseId,
    })).rejects.toThrow('Lease is no longer owned')
    state.job.leaseExpiresAt = new Date(Date.now() - 1_000)
    await expect(updateProducerLease(request(), {
      action: 'renew', jobId: state.job.id, workerId: 'producer-1', leaseId: claimed.job!.leaseId,
    })).rejects.toThrow('Lease is no longer owned')
  })
  it('refuses queue polling without its producer-only bearer secret', async () => {
    await expect(claimProducerJob(new Request('https://transovo.ai/test'), { workerId: 'worker-1' }))
      .rejects.toThrow('Producer queue credential required')
  })
})
