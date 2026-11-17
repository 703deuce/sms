import { describe, expect, it } from 'vitest'
import { customerQuestion, progressMayChangeWaiting, waitingExpired } from '../../lib/motion-studio/waiting-contract'

describe('Motion Studio producer waiting contract', () => {
  it('preserves long questions with links, dollar amounts, and the word bot', () => {
    const question = 'Which bot logo should we use? See https://example.com/brand and the $50 package. ' + 'Details '.repeat(38)
    expect(customerQuestion(question)).toBe(question.trim())
    expect(customerQuestion('a'.repeat(2500))).toHaveLength(2000)
    expect(customerQuestion('Use Bearer abcdefghijklmnop in testing')).not.toContain('abcdefghijklmnop')
  })
  it('does not let progress calls clear unanswered questions', () => {
    expect(progressMayChangeWaiting('needs_input')).toBe(false)
    expect(progressMayChangeWaiting('running')).toBe(true)
  })
  it('recognizes the 24-hour unanswered window', () => {
    const begin = new Date('2026-11-17T10:00:00Z')
    expect(waitingExpired(begin, new Date('2026-11-18T09:59:59Z'))).toBe(false)
    expect(waitingExpired(begin, new Date('2026-11-18T10:00:00Z'))).toBe(true)
  })
})
