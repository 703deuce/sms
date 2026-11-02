/**
 * Q6.5 AI-09: approve-first stock B-roll + no repeat within 60 s on timeline.
 */
import type { BrollItem } from '@/lib/clips/broll'

export const BROLL_ASSET_COOLDOWN_MS = 60_000

export function assetKey(item: Pick<BrollItem, 'assetId' | 'uploadId' | 'generationId'>): string | null {
  if (item.assetId) return `stock:${item.assetId}`
  if (item.uploadId) return `upload:${item.uploadId}`
  if (item.generationId) return `ai:${item.generationId}`
  return null
}

export function brollAssetBlockedByCooldown(
  timeline: readonly BrollItem[],
  candidate: Pick<BrollItem, 'startMs' | 'assetId' | 'uploadId' | 'generationId'>,
  windowMs = BROLL_ASSET_COOLDOWN_MS,
): boolean {
  const key = assetKey(candidate)
  if (!key) return false
  for (const row of timeline) {
    if (assetKey(row) !== key) continue
    if (Math.abs(row.startMs - candidate.startMs) < windowMs) return true
  }
  return false
}

export function filterAutoBrollSuggestions(
  existing: readonly BrollItem[],
  suggestions: BrollItem[],
): { accepted: BrollItem[]; rejected: { item: BrollItem; reason: string }[] } {
  const accepted: BrollItem[] = []
  const rejected: { item: BrollItem; reason: string }[] = []
  const combined = [...existing]
  for (const item of suggestions) {
    if (brollAssetBlockedByCooldown(combined, item)) {
      rejected.push({ item, reason: 'Same asset within 60 s' })
      continue
    }
    accepted.push(item)
    combined.push(item)
  }
  return { accepted, rejected }
}
