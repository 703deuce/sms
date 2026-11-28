import { describe, expect, it } from 'vitest'
import { goalPct, parseHandoff, type Goal } from '@/lib/agent-lab/team'

describe('GB-18 hand-off messages', () => {
  it('parses a hand-off request from the runner header', () => {
    const h = parseHandoff('[Hand-off from Chief of Staff · dlg_ab12CD]\nFind three competitors.')
    expect(h).toEqual({ kind: 'request', from: 'Chief of Staff', id: 'dlg_ab12CD', state: null, body: 'Find three competitors.' })
  })
  it('parses a hand-off result with its state', () => {
    const h = parseHandoff('[Hand-off result from Marketing · dlg_x9 · done]\nHere are the three.')
    expect(h?.kind).toBe('result')
    expect(h?.state).toBe('done')
    expect(h?.body).toBe('Here are the three.')
  })
  it('ignores ordinary messages', () => {
    expect(parseHandoff('Hand-off from me: hi')).toBeNull()
  })
  it('goal progress is a whole percent', () => {
    expect(goalPct({ progress: 0.456 } as Goal)).toBe(46)
    expect(goalPct({ progress: null } as Goal)).toBeNull()
  })
})
