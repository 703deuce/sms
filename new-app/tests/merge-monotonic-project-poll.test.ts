import { describe, expect, it } from 'vitest'
import { mergeMonotonicProjectPoll } from '@/lib/clips/eta-poll'

describe('mergeMonotonicProjectPoll', () => {
  it('keeps FINDING_CLIPS when server regresses to PREPARING on requeue', () => {
    const prev = {
      status: 'FINDING_CLIPS',
      stage: 'picker_pass1',
      progress: 52,
      etaSec: 180,
    }
    const next = {
      status: 'PREPARING',
      stage: 'preparing',
      progress: 8,
      etaSec: 400,
    }
    const merged = mergeMonotonicProjectPoll(prev, next)
    expect(merged.status).toBe('FINDING_CLIPS')
    expect(merged.stage).toBe('picker_pass1')
    expect(merged.progress).toBe(52)
    expect(merged.etaSec).toBeLessThanOrEqual(180)
  })
})
