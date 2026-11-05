import type { AiProducerOutputType, AiProducerRunConfig } from '@/lib/ai-producer-agent/types'
import { resolveAutoOutputType } from '@/lib/ai-producer-agent/decide'
import { CAPS } from '@/lib/ai-producer-agent/budget'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'

const STRONG = 0.72

export function planOutputs(
  ctx: ToolCtx,
  run: { outputType: AiProducerOutputType; config: AiProducerRunConfig },
) {
  type T = 'single_payoff' | 'montage' | 'story'
  if (run.config.editMode === 'just_chatting_rough_cut') return ['story' as T]
  if (run.outputType !== 'auto') return [run.outputType as T]
  const m = ctx.cache.moments ?? []
  const strong = m.filter((x) => Number(x.score ?? 0) >= STRONG)
  const out: T[] = []
  if (strong.length >= 1) out.push('single_payoff')
  if (ctx.cache.inventory?.links?.some((l) => l.kind === 'callback')) out.push('story')
  else if (strong.length >= 2) out.push('single_payoff')
  if (m.length >= 5 && ctx.totalSourceMs >= 10 * 60_000) out.push('montage')
  if (!out.length) out.push(resolveAutoOutputType(ctx.decideInput) as T)
  const max = Math.min(CAPS.maxEdits, run.config.maxEditsPerRun ?? CAPS.maxEdits)
  return out.slice(0, max)
}
