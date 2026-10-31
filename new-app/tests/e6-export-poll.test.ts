import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXPORT_POLL_MAX_ERRORS, startExportStatusPoll } from '@/lib/clips/editor/export-poll'

afterEach(() => vi.useRealTimers())

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('E6 export status poll', () => {
  it('keeps one request in flight (a hung request does not stack polls) and times it out', async () => {
    vi.useFakeTimers()
    const fetchStatus = vi.fn(() => new Promise<{ status: string }>(() => {}))
    const onError = vi.fn()
    const p = startExportStatusPoll({ fetchStatus, onResult: vi.fn(), onError, intervalMs: 2000, timeoutMs: 5000 })
    await vi.advanceTimersByTimeAsync(4000)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1500)
    expect(onError).toHaveBeenCalledWith('Export status check timed out', 1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetchStatus).toHaveBeenCalledTimes(2)
    p.stop()
  })

  it('keeps polling through transient errors and recovers to READY', async () => {
    vi.useFakeTimers()
    const seq = [
      () => Promise.resolve({ status: 'RENDERING', progress: 82 }),
      () => Promise.reject(new Error('Server error (500)')),
      () => Promise.reject(new Error('Server error (500)')),
      () => Promise.resolve({ status: 'READY', progress: 100 }),
    ]
    let i = 0
    const fetchStatus = vi.fn(() => seq[Math.min(i++, seq.length - 1)]!())
    const results: unknown[] = []
    const errors: number[] = []
    const p = startExportStatusPoll({
      fetchStatus,
      onResult: (r) => results.push(r),
      onError: (_m, streak) => errors.push(streak),
      intervalMs: 2000,
    })
    await vi.advanceTimersByTimeAsync(6100)
    expect(errors).toEqual([1, 2])
    expect(results.at(-1)).toEqual({ status: 'READY', progress: 100 })
    expect(EXPORT_POLL_MAX_ERRORS).toBeGreaterThan(2)
    p.stop()
  })

  it('drops responses that arrive after stop (no stale 82% after READY)', async () => {
    let resolveSlow: (v: { status: string }) => void = () => {}
    const fetchStatus = vi.fn(() => new Promise<{ status: string }>((r) => (resolveSlow = r)))
    const onResult = vi.fn()
    const p = startExportStatusPoll({ fetchStatus, onResult, onError: vi.fn(), intervalMs: 60_000 })
    p.stop()
    resolveSlow({ status: 'RENDERING' })
    await flush()
    expect(onResult).not.toHaveBeenCalled()
  })
})
