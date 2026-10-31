/**
 * EP1g: what users see for paid actions is CREDITS only — never our provider $ cost.
 * Credits come from the billing table (lib/billing/entitlements costOf). The provider USD helpers
 * (musicCostUsd, dubCostUsd, kieVideoCostUsd, …) stay for internal ai_usage / AiGeneration tracking.
 */
import { costOf } from '@/lib/billing/entitlements'

export function creditsLabel(n: number): string {
  return `${n} credit${n === 1 ? '' : 's'}`
}
export const musicCredits = (): number => costOf('', 'music')
export const aiBrollCredits = (): number => costOf('', 'ai_broll_shot')
export const thumbnailCredits = (): number => costOf('', 'thumbnail')
export function dubCredits(durationMs: number): number {
  const minutes = Math.max(1, Math.ceil(Math.max(1000, Number(durationMs) || 0) / 60_000))
  return costOf('', 'dub_minute') * minutes
}
