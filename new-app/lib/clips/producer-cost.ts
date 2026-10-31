/**
 * E4: what an AI Producer tool costs, shown on its card BEFORE anything runs.
 * Credits come from the billing table (lib/billing/entitlements costOf); the USD estimate from the
 * same helpers the confirm route reports (musicCostUsd, kieVideoCostUsd, dubCostUsd, $0.18 cover).
 * Edit tools (trim, captions, layout, title, brand…) are free: they only change clip edits.
 * The chat message itself is one LLM call per explicit Send (no credits defined for it).
 */
import { costOf } from '@/lib/billing/entitlements'
import { musicCostUsd } from '@/lib/clips/audio'
import { dubCostUsd } from '@/lib/clips/dub'
import { kieVideoCostUsd } from '@/lib/clips/kie-cost'

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
      const minutes = Math.max(1, Math.ceil(Math.max(1000, clipDurationMs) / 60_000))
      return { paid: true, credits: costOf('', 'dub_minute') * minutes, usd: dubCostUsd(clipDurationMs), label: 'AI dub' }
    }
    default:
      return { paid: false, credits: 0, usd: 0, label: 'Edit' }
  }
}

export function formatToolCost(c: ProducerToolCost): string {
  if (!c.paid) return 'Free · 0 credits'
  return `${c.credits} credit${c.credits === 1 ? '' : 's'} · ~$${c.usd.toFixed(2)}`
}
