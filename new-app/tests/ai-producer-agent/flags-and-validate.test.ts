import { describe, expect, it } from 'vitest'
import { isAiProducerAgentEnabledFromEnv } from '@/lib/features/ai-producer-agent-enabled'
import { validateEditPlan, validateHardIssues } from '@/lib/ai-producer-agent/validate'
import type { EditPlanJson } from '@/lib/ai-producer-agent/types'

describe('AI Producer Agent flags', () => {
  it('is off by default', () => {
    expect(isAiProducerAgentEnabledFromEnv({})).toBe(false)
  })
  it('enables with NEXT_PUBLIC_AI_PRODUCER_AGENT=1', () => {
    expect(isAiProducerAgentEnabledFromEnv({ NEXT_PUBLIC_AI_PRODUCER_AGENT: '1' })).toBe(true)
  })
})

describe('validateEditPlan', () => {
  const base: EditPlanJson = {
    genre: 'irl_just_chatting',
    outputType: 'single_payoff',
    platform: 'tiktok',
    targetLengthS: [15, 30],
    story: 'test',
    segments: [{ id: 's1', sourceId: 'a', srcInMs: 0, srcOutMs: 20_000, beat: 'payoff' }],
  }
  it('passes a simple in-range plan', () => {
    expect(validateHardIssues(validateEditPlan(base))).toHaveLength(0)
  })
  it('flags segment under 400ms', () => {
    const issues = validateHardIssues(
      validateEditPlan({ ...base, segments: [{ ...base.segments[0], srcOutMs: 200 }] }),
    )
    expect(issues.some((i) => i.ruleId === 'SEG-01')).toBe(true)
  })
})
