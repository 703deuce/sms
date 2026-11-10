import { describe, expect, it, vi } from 'vitest'
import { createMemoryStudioStore } from '@/lib/studio/store'
import { createStudioJob, type StudioService } from '@/lib/studio/jobs'
import { adSceneJobId } from '@/lib/server/ad-studio/queue'

vi.mock('server-only', () => ({}))

describe('Ad Studio B3b paid child idempotency', () => {
  it('reuses the same persisted job without a second KIE createTask', async () => {
    const store = createMemoryStudioStore()
    const createTask = vi.fn(async () => ({ taskId: 'remote-task-1' }))
    const svc = {
      store,
      kie: { createTask },
      storage: { driverName: () => 'test' },
      concurrencyLimit: 3,
      now: () => new Date(),
    } as unknown as StudioService
    const jobId = adSceneJobId('run1', 'scene1')
    const input = {
      workspaceId: 'ws1', userId: 'user1', jobId,
      body: { modelId: 'veo-3.1-lite', mode: 'text_to_video' as const, prompt: 'Product scene', aspect: '9:16' as const, durationSec: 4 },
    }
    const created = await createStudioJob(svc, input)
    expect(created.id).toBe(jobId)
    const replay = await createStudioJob(svc, input)
    expect(replay.id).toBe(jobId)
    expect(createTask).toHaveBeenCalledTimes(1)
    await expect(createStudioJob(svc, { ...input, body: { ...input.body, prompt: 'Different scene' } }))
      .rejects.toMatchObject({ code: 'INVALID_PARAMS' })
  })
  it('does not submit a paid call when capacity is full', async () => {
    const store = createMemoryStudioStore()
    const createTask = vi.fn()
    const svc = {
      store, kie: { createTask }, storage: { driverName: () => 'test' }, concurrencyLimit: 0, now: () => new Date(),
    } as unknown as StudioService
    await expect(createStudioJob(svc, {
      workspaceId: 'ws1', userId: 'user1', jobId: adSceneJobId('run2', 'scene1'),
      body: { modelId: 'veo-3.1-lite', mode: 'text_to_video', prompt: 'Product scene', durationSec: 4 },
    })).rejects.toMatchObject({ code: 'CONCURRENCY_LIMIT' })
    expect(createTask).not.toHaveBeenCalled()
  })
})
