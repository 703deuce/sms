import 'server-only'
import { prismaConnectionLimit } from '@/lib/server/db'

/**
 * Admission gate for customer-facing polling reads (status, activity, chat,
 * version list). Polls are the only traffic that can multiply without bound
 * (every open tab, every interval), so they get at most `pool - 2` concurrent
 * slots in this process. The remaining connections always stay free for
 * writes and for the producer's job-key bridge calls (progress, assets,
 * complete), so watching a project can never block delivery.
 *
 * A poll that cannot get a slot quickly fails fast with 503 + Retry-After; the
 * client simply skips that tick. It never sits in Prisma's 20s pool queue.
 */
export class PollBusyError extends Error {
  constructor() {
    super('The server is busy. Status will refresh automatically.')
    this.name = 'PollBusyError'
  }
}

type Waiter = { resolve: () => void; timer: ReturnType<typeof setTimeout> }

const state = globalThis as unknown as { __pollGate?: { active: number; queue: Waiter[] } }
function gate() {
  if (!state.__pollGate) state.__pollGate = { active: 0, queue: [] }
  return state.__pollGate
}

export function pollSlotLimit(): number {
  return Math.max(1, prismaConnectionLimit() - 2)
}

const MAX_QUEUE = 20
const MAX_WAIT_MS = 3_000

function release() {
  const g = gate()
  const next = g.queue.shift()
  if (next) {
    clearTimeout(next.timer)
    next.resolve()
    return
  }
  g.active = Math.max(0, g.active - 1)
}

async function acquire(): Promise<void> {
  const g = gate()
  if (g.active < pollSlotLimit()) {
    g.active += 1
    return
  }
  if (g.queue.length >= MAX_QUEUE) throw new PollBusyError()
  await new Promise<void>((resolve, reject) => {
    const waiter: Waiter = {
      resolve,
      timer: setTimeout(() => {
        const i = g.queue.indexOf(waiter)
        if (i >= 0) g.queue.splice(i, 1)
        reject(new PollBusyError())
      }, MAX_WAIT_MS),
    }
    g.queue.push(waiter)
  })
}

/** Run one polling read inside the bounded gate. The slot is always released. */
export async function withPollSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire()
  try {
    return await fn()
  } finally {
    release()
  }
}

/** Test-only: current gate occupancy. */
export function pollGateSnapshot() {
  const g = gate()
  return { active: g.active, queued: g.queue.length, limit: pollSlotLimit() }
}

/** 503 response for a poll that could not get a slot (client skips the tick). */
export function pollBusyResponse(): Response {
  return Response.json({ error: 'The server is busy. This will refresh automatically.', code: 'BUSY' },
    { status: 503, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' } })
}

/**
 * Wrap a GET route handler that the browser polls. The whole handler (auth
 * lookup included) runs inside one gate slot; when the gate is saturated the
 * route answers 503 immediately instead of queueing on the database pool.
 */
export function pollingRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await withPollSlot(() => handler(...args))
    } catch (err) {
      if (err instanceof PollBusyError) return pollBusyResponse()
      throw err
    }
  }
}
