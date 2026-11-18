import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyPoolError, withPrismaPoolRetry, prismaConnectionLimit } from '@/lib/server/db'
import { pollingRoute, pollGateSnapshot, pollSlotLimit, withPollSlot, PollBusyError } from '@/lib/server/db-read-gate'

const p2024 = Object.assign(new Error('Timed out fetching a new connection from the connection pool.'), { code: 'P2024' })
const poolerRejected = new Error('FATAL: Max client connections reached (EMAXCONNSESSION)')

describe('pool retry policy', () => {
  it('classifies local pool timeouts separately from pooler rejections', () => {
    expect(classifyPoolError(p2024)).toBe('local_pool_timeout')
    expect(classifyPoolError(poolerRejected)).toBe('pooler_rejected')
    expect(classifyPoolError(new Error('unique constraint'))).toBeNull()
  })

  it('fails fast on P2024 instead of re-queueing on the same full pool', async () => {
    const run = vi.fn(async () => { throw p2024 })
    await expect(withPrismaPoolRetry('User.findUnique', run)).rejects.toBe(p2024)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('retries a pooler rejection exactly once', async () => {
    let calls = 0
    const run = vi.fn(async () => { calls += 1; if (calls === 1) throw poolerRejected; return 'ok' })
    await expect(withPrismaPoolRetry('X.findMany', run)).resolves.toBe('ok')
    expect(run).toHaveBeenCalledTimes(2)
    const always = vi.fn(async () => { throw poolerRejected })
    await expect(withPrismaPoolRetry('X.findMany', always)).rejects.toBe(poolerRejected)
    expect(always).toHaveBeenCalledTimes(2)
  })
})

describe('polling read gate', () => {
  const original = process.env.DATABASE_URL
  afterEach(() => { process.env.DATABASE_URL = original })

  it('reserves two pooled connections for writes and the producer', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5'
    expect(prismaConnectionLimit()).toBe(5)
    expect(pollSlotLimit()).toBe(3)
    process.env.DATABASE_URL = 'postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres?connection_limit=2'
    expect(pollSlotLimit()).toBe(1)
  })

  it('many open project pages cannot take more than pool-2 slots, and excess polls fail fast with 503', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5'
    let release!: () => void
    const blocked = new Promise<void>((r) => { release = r })
    let concurrent = 0
    let peak = 0
    const slowRead = pollingRoute(async () => {
      concurrent += 1
      peak = Math.max(peak, concurrent)
      await blocked
      concurrent -= 1
      return new Response('ok')
    })
    // 3 slots + 20 queued + 7 over the queue cap: 30 polls from many tabs at once.
    const responses = Array.from({ length: 30 }, () => slowRead())
    await new Promise((r) => setTimeout(r, 10))
    expect(pollGateSnapshot().active).toBe(3)
    expect(peak).toBe(3)
    const early = await Promise.race([Promise.all(responses.slice(23)), new Promise((r) => setTimeout(() => r('timeout'), 50))])
    expect(Array.isArray(early)).toBe(true)
    for (const res of early as Response[]) expect(res.status).toBe(503)
    release()
    const all = await Promise.all(responses)
    expect(all.filter((r) => r.status === 200)).toHaveLength(23)
    expect(peak).toBe(3)
    expect(pollGateSnapshot()).toMatchObject({ active: 0, queued: 0 })
  })

  it('always releases the slot when the handler throws', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@db.example.supabase.co:6543/postgres?connection_limit=3'
    await expect(withPollSlot(async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(pollGateSnapshot().active).toBe(0)
    expect(new PollBusyError()).toBeInstanceOf(Error)
  })
})
