import type { AiProducerOutputType } from '@/lib/ai-producer-agent/types'
import { IRL_JC_LIMITS } from '@/lib/ai-producer-agent/rulepacks/irl_just_chatting.limits'
import { AI_PRODUCER_MAX_EDITS_PER_RUN } from '@/lib/ai-producer-agent/prompts'

export type ResolvedOutputType = 'single_payoff' | 'montage' | 'story'

/** DECIDE step when user output type is `auto` (heuristic until full Luna loop). */
export function resolveAutoOutputType(input: {
  instruction?: string | null
  momentCount: number
  multiSource: boolean
}): ResolvedOutputType {
  const text = (input.instruction ?? '').toLowerCase()
  if (text.includes('montage')) return 'montage'
  if (text.includes('story') || text.includes('callback') || text.includes('arc')) return 'story'
  if (input.multiSource && input.momentCount >= 4) return 'story'
  if (input.momentCount >= 5) return 'montage'
  return 'single_payoff'
}

export function defaultTargetLengthS(type: ResolvedOutputType): [number, number] {
  if (type === 'montage') return IRL_JC_LIMITS.montageShortTargetS
  if (type === 'story') return IRL_JC_LIMITS.storyTargetS
  return IRL_JC_LIMITS.singlePayoffTargetS
}

export function capEditsRequested(n: number): number {
  return Math.max(1, Math.min(AI_PRODUCER_MAX_EDITS_PER_RUN, n))
}

export function normalizeUserOutputType(raw: AiProducerOutputType): AiProducerOutputType {
  return raw
}
