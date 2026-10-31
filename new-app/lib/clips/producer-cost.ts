/**
 * E4: what an AI Producer tool costs, shown on its card BEFORE anything runs.
 * Credits come from the billing table (lib/billing/entitlements costOf). EP1g: users only ever see
 * credits; `usd` is the internal provider estimate (ai_usage tracking) and is never rendered.
 * Edit tools (trim, captions, layout, title, brand…) are free: they only change clip edits.
 * The chat message itself is one LLM call per explicit Send (no credits defined for it).
 */
import { costOf } from '@/lib/billing/entitlements'
import { musicCostUsd } from '@/lib/clips/audio'
import { dubCostUsd } from '@/lib/clips/dub'
import { kieVideoCostUsd } from '@/lib/clips/kie-cost'
import { creditsLabel, dubCredits } from '@/lib/clips/credit-cost'

export const PRODUCER_PAID_TOOLS = ['generate_ai_broll', 'generate_music', 'generate_thumbnail', 'dub'] as const
export const THUMBNAIL_COST_USD = 0.18

export type ProducerToolCost = { paid: boolean; credits: number; usd: number; label: string }

export function producerToolCost(
  tool: { name: string; args?: Record<string, unknown> },
  clipDurationMs: number,
): ProducerToolCost {
  const args = tool.args ?? {}
  switch (tool.name) {
    case 'generate_music':
      return { paid: true, credits: costOf('', 'music'), usd: musicCostUsd(clipDurationMs), label: 'AI music' }
    case 'generate_ai_broll': {
      const durationS = Number(args.durationS || 4)
      const res = args.resolution === '720p' ? '720p' : '480p'
      return { paid: true, credits: costOf('', 'ai_broll_shot'), usd: kieVideoCostUsd(durationS, res), label: 'AI B-roll shot' }
    }
    case 'generate_thumbnail':
      return { paid: true, credits: costOf('', 'thumbnail'), usd: THUMBNAIL_COST_USD, label: 'AI cover' }
    case 'dub': {
      return { paid: true, credits: dubCredits(clipDurationMs), usd: dubCostUsd(clipDurationMs), label: 'AI dub' }
    }
    default:
      return { paid: false, credits: 0, usd: 0, label: 'Edit' }
  }
}

/** User-facing cost line: credits only (EP1g — never the provider $ estimate). */
export function formatToolCost(c: ProducerToolCost): string {
  if (!c.paid) return 'Free · 0 credits'
  return creditsLabel(c.credits)
}
