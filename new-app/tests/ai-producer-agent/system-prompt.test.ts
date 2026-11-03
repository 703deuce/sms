import { describe, expect, it } from 'vitest'
import { buildAgentSystemPrompt, buildAgentSystemPromptForModel } from '@/lib/ai-producer-agent/prompts'
import { AI_PRODUCER_MAX_EDITS_PER_RUN } from '@/lib/ai-producer-agent/prompts'
import { resolveAutoOutputType, capEditsRequested } from '@/lib/ai-producer-agent/decide'
import { validateBrokenRules, validateHardIssues, validateEditPlan } from '@/lib/ai-producer-agent/validate'
import type { EditPlanJson } from '@/lib/ai-producer-agent/types'

describe('buildAgentSystemPrompt', () => {
  it('stacks base system.md before CORE, genre, template, platform', () => {
    const prompt = buildAgentSystemPromptForModel({
      genre: 'irl_just_chatting',
      outputType: 'auto',
      resolvedOutputType: 'single_payoff',
      platform: 'tiktok',
    })
    const idxBase = prompt.indexOf("You are Transovo's AI Producer")
    const idxCore = prompt.indexOf('CORE-01 HARD')
    const idxGenre = prompt.indexOf('IRL / Just Chatting')
    const idxTemplate = prompt.indexOf('Output template:')
    const idxPlatform = prompt.indexOf('Platform targets')
    expect(idxBase).toBeGreaterThan(-1)
    expect(idxCore).toBeGreaterThan(idxBase)
    expect(idxGenre).toBeGreaterThan(idxCore)
    expect(idxTemplate).toBeGreaterThan(idxGenre)
    expect(idxPlatform).toBeGreaterThan(idxTemplate)
  })

  it('includes max 3 edits and never pad from system.md', () => {
    const raw = buildAgentSystemPrompt({
      genre: 'irl_just_chatting',
      outputType: 'montage',
      platform: 'shorts',
    })
    expect(raw).toContain('max 3')
    expect(raw).toContain('Never pad')
    expect(raw).toContain('HARD rules may never be broken')
  })
})

describe('auto output type', () => {
  it('defaults to single_payoff for sparse inventory', () => {
    expect(resolveAutoOutputType({ momentCount: 1, multiSource: false })).toBe('single_payoff')
  })
  it('caps edits at 3', () => {
    expect(AI_PRODUCER_MAX_EDITS_PER_RUN).toBe(3)
    expect(capEditsRequested(9)).toBe(3)
  })
})

describe('brokenRules', () => {
  it('rejects breaking HARD rules', () => {
    const plan: EditPlanJson = {
      genre: 'irl_just_chatting',
      outputType: 'single_payoff',
      platform: 'tiktok',
      targetLengthS: [15, 30],
      story: 'x',
      segments: [{ id: 's1', sourceId: 'a', srcInMs: 0, srcOutMs: 20_000 }],
      brokenRules: [{ ruleId: 'CORE-03', reason: 'nope', severity: 'DEFAULT' }],
    }
    const hard = validateHardIssues(validateBrokenRules(plan))
    expect(hard.some((h) => h.message.includes('HARD'))).toBe(true)
  })
  it('allows cited soft rule breaks', () => {
    const plan: EditPlanJson = {
      genre: 'irl_just_chatting',
      outputType: 'single_payoff',
      platform: 'tiktok',
      targetLengthS: [15, 30],
      story: 'x',
      segments: [{ id: 's1', sourceId: 'a', srcInMs: 0, srcOutMs: 20_000 }],
      brokenRules: [{ ruleId: 'LEN-03', reason: 'held for silence joke', severity: 'HEURISTIC' }],
    }
    expect(validateHardIssues(validateBrokenRules(plan))).toHaveLength(0)
  })
})
