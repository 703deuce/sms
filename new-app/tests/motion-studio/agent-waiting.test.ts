import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

const state = vi.hoisted(() => ({
  job: {} as Record<string, any>,
  messages: [] as Record<string, any>[],
  failAck: false,
  webhook: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    motionStudioProject: {
      findFirst: vi.fn(async () => ({ id: 'msp_test', title: 'Test Film', status: 'setup', settings: {} })),
    },
    motionStudioAgentJob: {
      findFirst: vi.fn(async (args: any) => args.where?.id && args.where.id !== state.job.id ? null : state.job),
      findUnique: vi.fn(async () => state.job),
      findUniqueOrThrow: vi.fn(async () => state.job),
      updateMany: vi.fn(async (args: any) => {
        if (args.where.status === 'needs_input' && state.job.status !== 'needs_input') return { count: 0 }
        if (args.where.status?.in && !args.where.status.in.includes(state.job.status)) return { count: 0 }
        Object.assign(state.job, args.data)
        return { count: 1 }
      }),
    },
    motionStudioAgentMessage: {
      findFirst: vi.fn(async (args: any) => state.messages.find(x => x.id === args.where.id) ?? null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async (args: any) => {
        const row = { ...args.data, createdAt: new Date() }
        if (state.messages.some(m => m.id === row.id)) throw new Error('duplicate')
        state.messages.push(row)
        return row
      }),
      upsert: vi.fn(async (args: any) => {
        if (state.failAck) { state.failAck = false; throw new Error('simulated database failure') }
        const existing = state.messages.find(x => x.id === args.where.id)
        if (existing) return existing
        const row = { ...args.create, createdAt: new Date() }
        state.messages.push(row)
        return row
      }),
    },
    $transaction: async (fn: (tx: any) => unknown) => {
      const db = (await import('@/lib/server/db')).getPrisma()
      return fn(db)
    },
  }),
}))
vi.mock('@/lib/storage', () => ({ createReadableSignedUrl: vi.fn(), getClipStorage: vi.fn(), storageDriverName: () => 'test' }))
vi.mock('@/lib/server/clips/prisma-json', () => ({ toPrismaJson: (x: unknown) => x }))
vi.mock('@/lib/server/motion-studio/chat-assistant', () => ({
  interpretCustomerMessage: vi.fn(async () => ({ intent: 'question', reply: 'Hello', instruction: '' })),
}))

const { submitAgentRevision, botPostMessage, botProgress } = await import('../../lib/server/motion-studio/agent-bridge')

beforeEach(() => {
  state.messages = []
  state.failAck = false
  state.webhook.mockReset()
  state.job = {
    id: 'msaj_test', projectId: 'msp_test', workspaceId: 'ws_test', userId: 'user_test',
    status: 'needs_input', phase: 'review', progress: 30, message: 'Waiting for you',
    tokenHash: createHash('sha256').update('msaj_test:secret').digest('hex'),
    tokenExpiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(), updatedAt: new Date(), completedAt: null, resultKey: null, artifacts: [],
  }
  process.env.GROKBOT_WEBHOOK_URL = 'https://example.com/producer'
  process.env.GROKBOT_WEBHOOK_KEY = 'key'
  vi.stubGlobal('fetch', state.webhook)
  state.webhook.mockResolvedValue({ ok: true, status: 200 })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('producer clarification and retries', () => {
  it('stores a complete question and progress cannot clear needs_input', async () => {
    state.job.status = 'running'
    const request = new Request('https://transovo.ai/test', { headers: { Authorization: 'Bearer secret' } })
    const question = 'Which bot logo? https://example.com/logo costs $50. ' + 'More detail '.repeat(45)
    const posted = await botPostMessage('msaj_test', request, { text: question, needsInput: true })
    expect(posted.text).toBe(question)
    expect(state.job.status).toBe('needs_input')
    await botProgress('msaj_test', request, { stage: 'scenes', percent: 90 })
    expect(state.job.status).toBe('needs_input')
    expect(state.job.progress).toBe(30)
  })
  it('replays a stored answer if its webhook succeeded but the confirmation write failed', async () => {
    const request = new Request('https://transovo.ai/api/motion-studio/agent/projects/msp_test/chat',
      { method: 'POST', headers: { 'Idempotency-Key': 'answer-one' } })
    state.failAck = true
    await expect(submitAgentRevision('ws_test','user_test','msp_test',request,
      { instruction: 'Use the first image', answerInput: true })).rejects.toThrow('simulated database failure')
    expect(state.job.status).toBe('running')
    expect(state.messages.filter(m => m.role === 'customer')).toHaveLength(1)
    const result = await submitAgentRevision('ws_test','user_test','msp_test',request,
      { instruction: 'Use the first image', answerInput: true })
    expect(result.intent).toBe('conversation')
    expect(state.webhook).toHaveBeenCalledTimes(2)
    const first = JSON.parse(state.webhook.mock.calls[0]![1].body)
    const second = JSON.parse(state.webhook.mock.calls[1]![1].body)
    expect(first).toMatchObject({ action: 'answer_input', jobId: 'msaj_test', idempotencyKey: 'answer-one' })
    expect(second).toEqual(first)
    expect(state.messages.filter(m => m.role === 'agent')).toHaveLength(1)
  })
})
