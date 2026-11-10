import { describe, expect, it, vi } from 'vitest'
import {
  loadProjectClipsWithRetry,
  retryIdempotentRequest,
  ProjectClipListAbortedError,
  ProjectClipListTimeoutError,
} from '@/lib/clips/project-clips-list-retry'

function httpError(status: number) {
  const error = new Error(`HTTP ${status}`) as Error & { status: number }
  error.status = status
  return error
}

describe('project clips list bounded recovery', () => {
  it('retries one 502 then returns the successful list', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(httpError(502))
      .mockResolvedValueOnce([{ id: 'clip_1' }])
    const result = await loadProjectClipsWithRetry({
      load,
      maxAttempts: 4,
      baseDelayMs: 0,
      timeoutMs: 100,
    })
    expect(result.rows).toEqual([{ id: 'clip_1' }])
    expect(result.attempts).toBe(2)
    expect(result.expectedMissing).toBe(false)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('accepts a successful zero-clip response when zero is expected', async () => {
    const load = vi.fn(async () => [] as { id: string }[])
    const result = await loadProjectClipsWithRetry({
      load,
      expectedCount: 0,
      maxAttempts: 4,
      baseDelayMs: 0,
      timeoutMs: 100,
    })
    expect(result.rows).toEqual([])
    expect(result.attempts).toBe(1)
    expect(result.expectedMissing).toBe(false)
  })

  it('does not replace known saved clips with a repeated empty list', async () => {
    const load = vi.fn(async () => [] as { id: string }[])
    const result = await loadProjectClipsWithRetry({
      load,
      expectedCount: 7,
      maxAttempts: 3,
      baseDelayMs: 0,
      timeoutMs: 100,
    })
    expect(result.rows).toEqual([])
    expect(result.attempts).toBe(3)
    expect(result.expectedMissing).toBe(true)
  })

  it('times out a stalled request within the retry bound', async () => {
    const load = vi.fn((signal: AbortSignal) => new Promise<{ id: string }[]>((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    await expect(loadProjectClipsWithRetry({
      load,
      maxAttempts: 2,
      baseDelayMs: 0,
      timeoutMs: 5,
    })).rejects.toBeInstanceOf(ProjectClipListTimeoutError)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('cancels a stale retry on navigation/unmount', async () => {
    const controller = new AbortController()
    const load = vi.fn(async () => {
      throw httpError(502)
    })
    const run = loadProjectClipsWithRetry({
      load,
      signal: controller.signal,
      maxAttempts: 4,
      baseDelayMs: 100,
      timeoutMs: 100,
    })
    controller.abort()
    await expect(run).rejects.toBeInstanceOf(ProjectClipListAbortedError)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('retries the deduped thumbnail backfill only for transient failures', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce({ queued: 1 })
    await expect(retryIdempotentRequest({
      request,
      maxAttempts: 3,
      baseDelayMs: 0,
      timeoutMs: 100,
    })).resolves.toEqual({ queued: 1 })
    expect(request).toHaveBeenCalledTimes(2)

    const badRequest = vi.fn().mockRejectedValue(httpError(400))
    await expect(retryIdempotentRequest({
      request: badRequest,
      maxAttempts: 3,
      baseDelayMs: 0,
      timeoutMs: 100,
    })).rejects.toMatchObject({ status: 400 })
    expect(badRequest).toHaveBeenCalledTimes(1)
  })
})
