export class ProjectClipListAbortedError extends Error {
  constructor() {
    super('Clips list request was canceled')
    this.name = 'ProjectClipListAbortedError'
  }
}

export class ProjectClipListTimeoutError extends Error {
  constructor() {
    super('Clips list request timed out')
    this.name = 'ProjectClipListTimeoutError'
  }
}

function isAbortError(error: unknown) {
  return error instanceof ProjectClipListAbortedError
}

function isRetryableError(error: unknown) {
  if (error instanceof ProjectClipListTimeoutError) return true
  const status = Number((error as { status?: unknown } | null)?.status)
  if (Number.isFinite(status)) return status === 408 || status === 429 || status >= 500
  return true
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new ProjectClipListAbortedError()
}

async function delayWithSignal(ms: number, signal?: AbortSignal) {
  throwIfAborted(signal)
  if (ms <= 0) return
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const onAbort = () => {
      cleanup()
      reject(new ProjectClipListAbortedError())
    }
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function runTimedAttempt<T>(
  request: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  throwIfAborted(signal)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null
  let onAbort: (() => void) | null = null
  const stop = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort()
      reject(new ProjectClipListAbortedError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => {
      controller.abort()
      reject(new ProjectClipListTimeoutError())
    }, timeoutMs)
  })
  try {
    return await Promise.race([request(controller.signal), stop])
  } finally {
    if (timer) clearTimeout(timer)
    if (onAbort) signal?.removeEventListener('abort', onAbort)
  }
}

export type ProjectClipListRetryResult<T> = {
  rows: T[]
  attempts: number
  expectedMissing: boolean
}

export async function loadProjectClipsWithRetry<T>(opts: {
  load: (signal: AbortSignal) => Promise<T[]>
  signal?: AbortSignal
  expectedCount?: number
  maxAttempts?: number
  baseDelayMs?: number
  timeoutMs?: number
}): Promise<ProjectClipListRetryResult<T>> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 4)
  const baseDelayMs = Math.max(0, opts.baseDelayMs ?? 500)
  const timeoutMs = Math.max(1, opts.timeoutMs ?? 8_000)
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfAborted(opts.signal)
    try {
      const rows = await runTimedAttempt(opts.load, opts.signal, timeoutMs)
      const expectedMissing = (opts.expectedCount ?? 0) > 0 && rows.length === 0
      if (!expectedMissing || attempt === maxAttempts) {
        return { rows, attempts: attempt, expectedMissing }
      }
    } catch (error) {
      if (isAbortError(error)) throw error
      lastError = error
      if (!isRetryableError(error) || attempt === maxAttempts) throw error
    }
    await delayWithSignal(baseDelayMs * 2 ** (attempt - 1), opts.signal)
  }

  throw lastError instanceof Error ? lastError : new Error('Clips list retry exhausted')
}

export async function retryIdempotentRequest<T>(opts: {
  request: (signal: AbortSignal) => Promise<T>
  signal?: AbortSignal
  maxAttempts?: number
  baseDelayMs?: number
  timeoutMs?: number
}): Promise<T> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3)
  const baseDelayMs = Math.max(0, opts.baseDelayMs ?? 750)
  const timeoutMs = Math.max(1, opts.timeoutMs ?? 8_000)
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfAborted(opts.signal)
    try {
      return await runTimedAttempt(opts.request, opts.signal, timeoutMs)
    } catch (error) {
      if (isAbortError(error)) throw error
      lastError = error
      if (attempt === maxAttempts) throw error
    }
    await delayWithSignal(baseDelayMs * 2 ** (attempt - 1), opts.signal)
  }

  throw lastError instanceof Error ? lastError : new Error('Request retry exhausted')
}
