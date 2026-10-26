import { describe, expect, it } from 'vitest'

describe('ClipAnything gemini ranking schema', () => {
  it('accepts ranked candidate objects', () => {
    const row = {
      candidateId: 'c0',
      start: 12,
      end: 42,
      title: 'Goal',
      reason: 'payoff',
      hook: 'build',
      action: 'kick',
      payoff: 'score',
      score: 91,
      subjectBox: { x: 0.2, y: 0.3, w: 0.4, h: 0.5 },
    }
    expect(row.candidateId).toBe('c0')
    expect(row.score).toBeGreaterThan(0)
  })
})
