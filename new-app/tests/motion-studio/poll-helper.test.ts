import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIN_POLL_MS, startPolling } from '@/lib/motion-studio/poll'

describe('startPolling', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('never overlaps ticks and enforces the minimum interval', async () => {
    let inFlight = 0
    let peak = 0
    let calls = 0
    const stop = startPolling(async () => {
      calls += 1
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 12_000)) // a slow server answer
      inFlight -= 1
    }, { intervalMs: 1500, immediate: true })
    await vi.advanceTimersByTimeAsync(60_000)
    stop()
    expect(peak).toBe(1)
    // 12s request + 5s gap => at most 4 calls per minute (was 40 with a 1.5s setInterval).
    expect(calls).toBeLessThanOrEqual(4)
    expect(MIN_POLL_MS).toBe(5000)
  })

  it('stops when the tick returns false (job complete/failed)', async () => {
    let calls = 0
    startPolling(async () => { calls += 1; return calls < 2 }, { immediate: true })
    await vi.advanceTimersByTimeAsync(120_000)
    expect(calls).toBe(2)
  })

  it('backs off exponentially after errors', async () => {
    const at: number[] = []
    const stop = startPolling(async () => { at.push(Date.now()); throw new Error('503') }, { intervalMs: 5000, maxIntervalMs: 40_000, immediate: true })
    await vi.advanceTimersByTimeAsync(80_000)
    stop()
    const gaps = at.slice(1).map((t, i) => t - at[i])
    expect(gaps.slice(0, 3)).toEqual([10_000, 20_000, 40_000])
  })
})
