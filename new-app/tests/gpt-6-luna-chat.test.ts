import { describe, expect, it } from 'vitest'
import { gpt6ChatCompletionExtras, isGpt6FamilyModel } from '@/lib/server/ai/gpt-6-luna-chat'

describe('gpt6ChatCompletionExtras', () => {
  it('uses reasoning_effort for gpt-6-luna', () => {
    const extras = gpt6ChatCompletionExtras('gpt-6-luna')
    expect(extras.reasoning_effort).toBe('none')
    expect(extras.max_completion_tokens).toBe(4096)
    expect(extras).not.toHaveProperty('temperature')
  })

  it('keeps temperature for legacy models', () => {
    expect(gpt6ChatCompletionExtras('gpt-4o-mini').temperature).toBe(0.4)
  })

  it('detects gpt-6 family', () => {
    expect(isGpt6FamilyModel('gpt-6-luna')).toBe(true)
    expect(isGpt6FamilyModel('gpt-4o-mini')).toBe(false)
  })
})
