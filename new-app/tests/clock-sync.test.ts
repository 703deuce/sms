import { describe, expect, it } from 'vitest'
import { bestOffsetFromSamples, offsetFromSample } from '@/lib/recording/clock-sync'

describe('clock-sync', () => {
  it('computes offset from round-trip sample', () => {
    const { offsetMs, rttMs } = offsetFromSample(1000, 1100, 1055)
    expect(rttMs).toBe(100)
    expect(offsetMs).toBe(5)
  })

  it('picks minimum RTT sample', () => {
    const offset = bestOffsetFromSamples([
      { rttMs: 80, offsetMs: 10 },
      { rttMs: 40, offsetMs: 7 },
      { rttMs: 120, offsetMs: 3 },
    ])
    expect(offset).toBe(7)
  })
})
