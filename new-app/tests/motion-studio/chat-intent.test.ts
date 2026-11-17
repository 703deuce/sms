import { describe, expect, it } from 'vitest'
import { isStatusQuestion, statusReply, publicAssistantText } from '../../lib/motion-studio/chat-intent'

describe('Motion Studio assistant intent helpers', () => {
  it('answers routine progress questions without an agent render', () => {
    expect(isStatusQuestion('Is my video ready?')).toBe(true)
    expect(isStatusQuestion('What are you working on?')).toBe(true)
    expect(isStatusQuestion('Make scene 2 shorter')).toBe(false)
  })
  it('uses actual job state in responses', () => {
    expect(statusReply('running', 'rendering', 45)).toContain('45%')
    expect(statusReply('needs_input', 'review', 40)).toContain('needs an answer')
    expect(statusReply('complete', 'complete', 100)).toContain('ready')
  })
  it('redacts accidental vendor references', () => {
    expect(publicAssistantText('Grokbot webhook error')).not.toContain('Grokbot')
    expect(publicAssistantText('Change the title to gold')).toBe('Change the title to gold')
    expect(publicAssistantText("I've changed the intro.")).not.toContain('changed the intro')
  })
})
