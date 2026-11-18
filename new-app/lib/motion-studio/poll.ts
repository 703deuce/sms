/**
 * Browser polling for Motion Studio pages.
 *
 * Every open project tab used to run several independent `setInterval` loops
 * (1.5s-5s each, some forever). When the server slowed down, intervals kept
 * firing while earlier requests were still waiting, so requests piled up and a
 * single open page could occupy the whole database pool. This helper is the one
 * place those loops go through:
 *  - never overlaps: the next tick is scheduled only after the previous finished;
 *  - minimum interval MIN_POLL_MS;
 *  - exponential backoff (up to maxIntervalMs) after errors / 503 busy answers;
 *  - pauses while the tab is hidden and resumes when it is visible again;
 *  - the tick returns `false` to stop (e.g. the job is complete or failed).
 */
export const MIN_POLL_MS = 5_000

export type PollTick = () => Promise<boolean | void>

export type PollOptions = { intervalMs?: number; maxIntervalMs?: number; immediate?: boolean }

export function startPolling(tick: PollTick, opts: PollOptions = {}): () => void {
  const base = Math.max(MIN_POLL_MS, opts.intervalMs ?? MIN_POLL_MS)
  const max = Math.max(base, opts.maxIntervalMs ?? 60_000)
  let delay = base
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let waitingForVisible = false
  const doc: Document | null = typeof document !== 'undefined' ? document : null

  const schedule = (ms: number) => {
    if (stopped) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(run, ms)
  }

  const onVisible = () => {
    if (stopped || !waitingForVisible || doc?.hidden) return
    waitingForVisible = false
    void run()
  }

  async function run() {
    timer = null
    if (stopped || running) return
    if (doc?.hidden) {
      waitingForVisible = true
      return
    }
    running = true
    let keepGoing = true
    try {
      const result = await tick()
      keepGoing = result !== false
      delay = base
    } catch {
      delay = Math.min(max, delay * 2)
    } finally {
      running = false
    }
    if (!keepGoing) {
      stop()
      return
    }
    schedule(delay)
  }

  function stop() {
    stopped = true
    if (timer) clearTimeout(timer)
    timer = null
    doc?.removeEventListener('visibilitychange', onVisible)
  }

  doc?.addEventListener('visibilitychange', onVisible)
  if (opts.immediate) void run()
  else schedule(base)
  return stop
}

/** Thrown by poll fetches for non-OK answers so the poller backs off. */
export class PollHttpError extends Error {
  constructor(public status: number) {
    super('Request failed with status ' + status)
    this.name = 'PollHttpError'
  }
}

type AgentJobResult = { job: unknown | null }
const inflight = new Map<string, Promise<AgentJobResult>>()
const cache = new Map<string, { at: number; value: AgentJobResult }>()
const SHARED_TTL_MS = 2_000

/**
 * One `/api/motion-studio/agent/jobs?projectId=` read shared by every panel on
 * the page (workspace header, chat panel, job panel): concurrent callers share
 * the in-flight request and a result younger than 2s is reused.
 */
export async function fetchAgentJobShared<T = unknown>(projectId: string, opts: { fresh?: boolean } = {}): Promise<{ job: T | null }> {
  const hit = cache.get(projectId)
  if (!opts.fresh && hit && Date.now() - hit.at < SHARED_TTL_MS) return hit.value as { job: T | null }
  const pending = inflight.get(projectId)
  if (pending) return pending as Promise<{ job: T | null }>
  const request = (async () => {
    const response = await fetch('/api/motion-studio/agent/jobs?projectId=' + encodeURIComponent(projectId), { cache: 'no-store' })
    if (!response.ok) throw new PollHttpError(response.status)
    const data = await response.json() as { job?: unknown | null }
    const value = { job: data.job ?? null }
    cache.set(projectId, { at: Date.now(), value })
    return value
  })()
  inflight.set(projectId, request)
  try {
    return await request as { job: T | null }
  } finally {
    inflight.delete(projectId)
  }
}

export const AGENT_JOB_CHANGED_EVENT = 'motion-studio:agent-job-changed'

/** Tell every panel that a job was started, answered, cancelled or restored, so stopped pollers resume. */
export function notifyAgentJobChanged(projectId: string) {
  cache.delete(projectId)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(AGENT_JOB_CHANGED_EVENT, { detail: { projectId } }))
}

const ACTIVE_AGENT_STATUSES = new Set(['queued', 'dispatching', 'dispatched', 'running', 'needs_input'])
export function agentJobIsActive(job: { status?: string } | null | undefined): boolean {
  return Boolean(job?.status && ACTIVE_AGENT_STATUSES.has(job.status))
}
