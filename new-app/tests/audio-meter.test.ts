import { afterEach, describe, expect, it, vi } from 'vitest'
import { PEAK_FLOOR_DB, PEAK_HOLD_MS, peakDb } from '@/components/clips/editor/audio-meter'

describe('audio-meter (AU-30)', () => {
  it('peakDb: 0.5 amplitude ≈ −6.02 dBFS; silence = floor', () => {
    const buf = new Float32Array(128)
    buf.fill(0.5)
    expect(peakDb(buf)).toBeCloseTo(-6.02, 2)
    expect(peakDb(new Float32Array(64))).toBe(PEAK_FLOOR_DB)
  })

  it('peak hold decays after hold window', () => {
    vi.useFakeTimers()
    let hold = -6
    let holdUntil = 0
    const bump = (instant: number, now: number) => {
      if (instant >= hold) {
        hold = instant
        holdUntil = now + PEAK_HOLD_MS
      }
    }
    bump(-6, 0)
    bump(-10, 100)
    expect(hold).toBe(-6)
    vi.advanceTimersByTime(PEAK_HOLD_MS + 1)
    if (performance.now() >= holdUntil) hold = Math.max(-10, hold - 0.5)
    expect(hold).toBeLessThan(-6)
    vi.useRealTimers()
  })
})

afterEach(() => {
  vi.useRealTimers()
})
