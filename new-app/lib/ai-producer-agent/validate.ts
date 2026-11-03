import type { EditPlanJson } from '@/lib/ai-producer-agent/types'
import { IRL_JC_LIMITS } from '@/lib/ai-producer-agent/rulepacks/irl_just_chatting.limits'

export type ValidateContext = {
  wordSpans?: Array<{ s: number; e: number }>
  laughSpans?: Array<{ s: number; e: number }>
  sensesChecked?: Set<string>
}

export type ValidateIssue = { ruleId: string; message: string; hard: boolean }

/** Rule IDs that must never appear in plan.brokenRules (HARD only). */
export const HARD_RULE_ID_PREFIXES = ['CORE-', 'CUT-WORD', 'CUT-LAUGH', 'SEG-01', 'LEN-01', 'LEN-02'] as const

export function isHardRuleId(ruleId: string): boolean {
  return HARD_RULE_ID_PREFIXES.some((p) => ruleId.startsWith(p) || ruleId === p)
}

export function validateBrokenRules(plan: EditPlanJson): ValidateIssue[] {
  const issues: ValidateIssue[] = []
  for (const br of plan.brokenRules ?? []) {
    if (!br.reason?.trim()) {
      issues.push({ ruleId: br.ruleId, message: 'broken rule requires reason', hard: true })
    }
    if (isHardRuleId(br.ruleId) || br.ruleId.includes('HARD')) {
      issues.push({ ruleId: br.ruleId, message: 'HARD rules cannot be broken', hard: true })
    }
  }
  return issues
}

export function validateEditPlan(plan: EditPlanJson, ctx: ValidateContext = {}): ValidateIssue[] {
  const issues: ValidateIssue[] = [...validateBrokenRules(plan)]
  const [minLen, maxLen] = plan.targetLengthS ?? IRL_JC_LIMITS.singlePayoffTargetS
  const totalMs = plan.segments.reduce((acc, seg) => acc + Math.max(0, seg.srcOutMs - seg.srcInMs), 0)
  const totalS = totalMs / 1000
  if (plan.outputType === 'single_payoff') {
    if (totalS < IRL_JC_LIMITS.singlePayoffMinS) {
      issues.push({ ruleId: 'LEN-01', message: 'clip too short', hard: true })
    }
    if (totalS > IRL_JC_LIMITS.singlePayoffHardMaxS) {
      issues.push({ ruleId: 'LEN-02', message: 'clip exceeds hard max', hard: true })
    }
  }
  if (plan.outputType === 'story' && totalS > IRL_JC_LIMITS.storyHardMaxS) {
    issues.push({ ruleId: 'LEN-STORY', message: 'story exceeds hard max', hard: true })
  }
  const citedSoft = new Set((plan.brokenRules ?? []).map((b) => b.ruleId))
  if (totalS < minLen * 0.5 || totalS > maxLen * 2) {
    if (!citedSoft.has('LEN-03')) {
      issues.push({ ruleId: 'LEN-03', message: 'length outside target band', hard: false })
    }
  }
  for (const seg of plan.segments) {
    if (seg.srcOutMs - seg.srcInMs < 400) {
      issues.push({ ruleId: 'SEG-01', message: `segment ${seg.id} under 400ms`, hard: true })
    }
    for (const w of ctx.wordSpans ?? []) {
      if (seg.srcOutMs > w.s + 30 && seg.srcOutMs < w.e - 30) {
        issues.push({ ruleId: 'CUT-WORD', message: 'cut inside word', hard: true })
      }
    }
    for (const laugh of ctx.laughSpans ?? []) {
      const mid = (seg.srcOutMs + seg.srcInMs) / 2
      if (mid > laugh.s && mid < laugh.e) {
        issues.push({ ruleId: 'CUT-LAUGH', message: 'cut inside laugh span', hard: true })
      }
    }
  }
  if ((ctx.sensesChecked?.size ?? 0) < 1 && plan.segments.length) {
    issues.push({ ruleId: 'CORE-01', message: 'three-senses metadata missing (dev)', hard: false })
  }
  return issues
}

export function validateHardIssues(issues: ValidateIssue[]): ValidateIssue[] {
  return issues.filter((i) => i.hard)
}
