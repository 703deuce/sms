import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Worker -> web progress callback must ack fast: the unified auto-start runs after
// the status update, in the background, and its failures are logged, not thrown
// (job_b10ed571 / proj_f32e136d, 2026-11-10).

const h = vi.hoisted(() => ({
  autoStart: vi.fn<(projectId: string) => Promise<unknown>>(),
  apply: vi.fn(async () => undefined),
  findUnique: vi.fn(),
}))

vi.mock('@/lib/server/clips/worker-auth', () => ({ verifyWorkerHmac: () => true }))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({ clipJob: { findUnique: h.findUnique } }),
}))
vi.mock('@/lib/server/clips/job-progress', () => ({
  applyWorkerJobProgress: h.apply,
  isStaleWorkerPost: () => false,
}))
vi.mock('@/lib/storage', () => ({ getClipStorage: () => ({ putJson: vi.fn(async () => undefined) }) }))
vi.mock('@/lib/server/streamer/agent-batch', () => ({
  maybeAutoStartUploadAgentBatch: h.autoStart,
}))

const JOB = {
  id: 'job_b10ed571',
  projectId: 'proj_95576ba8',
  status: 'RUNNING',
  type: 'PROCESS_PROJECT',
  payload: {},
  error: null,
  lockedBy: 'w1',
  project: { transcriptKey: null, sourceKind: 'upload' },
}

function post(body: Record<string, unknown>) {
  return new Request('https://transovo.test/api/internal/jobs/job_b10ed571/progress', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const DONE_FINDING = {
  projectStatus: 'FINDING_CLIPS',
  stage: 'finding_clips',
  progress: 50,
  jobStatus: 'DONE',
  error: null,
  workerId: 'w1',
}

const flush = () => new Promise<void>((r) => setImmediate(r))

describe('POST /api/internal/jobs/[id]/progress ack-fast', () => {
  beforeEach(() => {
    h.autoStart.mockReset()
    h.apply.mockClear()
    h.findUnique.mockReset().mockResolvedValue(JOB)
  })
  afterEach(() => vi.restoreAllMocks())

  it('returns before the unified auto-start finishes', async () => {
    let release!: () => void
    let finished = false
    h.autoStart.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => {
            finished = true
            resolve(null)
          }
        }),
    )
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { POST } = await import('@/app/api/internal/jobs/[id]/progress/route')

    const res = await POST(post(DONE_FINDING), { params: Promise.resolve({ id: 'job_b10ed571' }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { ok: true } })
    expect(h.apply).toHaveBeenCalledTimes(1)
    // Responded while auto-start is still pending (it had not even been entered yet).
    expect(finished).toBe(false)

    await flush()
    await flush()
    expect(h.autoStart).toHaveBeenCalledWith('proj_95576ba8')
    expect(finished).toBe(false)
    release()
    await flush()
    expect(finished).toBe(true)

    const ack = info.mock.calls.find((c) => c[0] === '[clipper:progress] ack')
    expect(ack?.[1]).toMatchObject({ jobId: 'job_b10ed571', autoStartScheduled: true })
    expect(typeof (ack?.[1] as { latencyMs?: unknown }).latencyMs).toBe('number')
  })

  it('logs auto-start errors instead of throwing or failing the ack', async () => {
    h.autoStart.mockRejectedValue(new Error('ai_producer_pool_timeout'))
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { POST } = await import('@/app/api/internal/jobs/[id]/progress/route')

    const res = await POST(post(DONE_FINDING), { params: Promise.resolve({ id: 'job_b10ed571' }) })
    expect(res.status).toBe(200)
    await flush()
    await flush()
    const failed = err.mock.calls.find((c) => c[0] === '[clipper:agent] auto_start_hook_failed')
    expect(failed?.[1]).toMatchObject({
      projectId: 'proj_95576ba8',
      jobId: 'job_b10ed571',
      error: 'Error: ai_producer_pool_timeout',
    })
  })

  it('does not schedule auto-start for non-hook progress (RUNNING heartbeat)', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const { POST } = await import('@/app/api/internal/jobs/[id]/progress/route')
    const res = await POST(
      post({ projectStatus: 'TRANSCRIBING', stage: 'transcribing', progress: 12, jobStatus: 'RUNNING', workerId: 'w1' }),
      { params: Promise.resolve({ id: 'job_b10ed571' }) },
    )
    expect(res.status).toBe(200)
    await flush()
    expect(h.autoStart).not.toHaveBeenCalled()
  })
})

describe('scheduleUnifiedAutoStart', () => {
  it('never rejects, even when start throws synchronously', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { scheduleUnifiedAutoStart } = await import('@/lib/server/clips/progress-auto-start')
    const task = scheduleUnifiedAutoStart('p1', 'j1', () => {
      throw new Error('boom')
    })
    await expect(task).resolves.toBeUndefined()
    expect(err).toHaveBeenCalledWith(
      '[clipper:agent] auto_start_hook_failed',
      expect.objectContaining({ projectId: 'p1', jobId: 'j1', error: 'Error: boom' }),
    )
    err.mockRestore()
  })
})
