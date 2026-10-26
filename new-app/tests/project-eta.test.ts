import { describe, expect, it } from 'vitest'
import { computeNonStreamerClipEtaSec } from '@/lib/server/clips/project-eta'

describe('computeNonStreamerClipEtaSec', () => {
  it('hides ETA until progress starts', () => {
    expect(
      computeNonStreamerClipEtaSec({ progress: 0, createdAtMs: Date.now() - 600_000 }),
    ).toBe(0)
  })

  it('estimates from elapsed time and progress', () => {
    const createdAtMs = 1_000_000
    const nowMs = createdAtMs + 570_000 // 9.5 min elapsed
    const eta = computeNonStreamerClipEtaSec({ progress: 50, createdAtMs, nowMs })
    expect(eta).toBeGreaterThan(500)
    expect(eta).toBeLessThan(650)
  })
})
