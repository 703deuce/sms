import 'server-only'

import { searchVideos, findCachedHit, ensureStockAsset, type PixabayHitPublic } from '@/lib/server/ai/pixabay'
import { AdStudioError } from '@/lib/ad-studio/errors'

const tokens = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
const stop = new Set(['that','with','your','from','have','this','more','into','about','their','using','product','best','great'])

export function selectStockHit(hits: PixabayHitPublic[], query: string, durationSec: number, aspect: string): PixabayHitPublic | null {
  console.info('[ad-studio:stock] rank_begin', { candidates: hits.length, durationSec, aspect })
  const words = tokens(query).filter((w) => !stop.has(w))
  const eligible = hits.filter((h) => Boolean(h.providerId) && h.durationS >= durationSec && h.width > 0 && h.height > 0)
  if (!eligible.length) { console.info('[ad-studio:stock] rank_empty'); return null }
  const scored = eligible.map((h) => {
    const tags = new Set(tokens(h.tags))
    const relevance = words.reduce((s, w) => s + (tags.has(w) ? 1 : 0), 0)
    const ratio = h.width / h.height
    const fit = aspect === '9:16' ? ratio < 1 : aspect === '16:9' ? ratio > 1 : ratio >= 0.8 && ratio <= 1.25
    return { hit: h, score: relevance * 10 + (fit ? 4 : 0) + Math.min(h.durationS, 30) / 100 }
  }).sort((a, b) => b.score - a.score || a.hit.providerId.localeCompare(b.hit.providerId))
  const top = scored[0]!.hit
  console.info('[ad-studio:stock] rank_selected', { providerId: top.providerId, durationSec, score: scored[0]!.score })
  return top
}

/** A catalog outage is not a license to invent stock provenance. It returns no candidate. */
export async function findStockForScene(query: string, durationSec: number, aspect: string, search = searchVideos): Promise<PixabayHitPublic | null> {
  console.info('[ad-studio:stock] search_begin', { queryLength: query.length, durationSec })
  if (!query.trim()) return null
  try {
    const hits = await search(query.slice(0, 100), 1)
    console.info('[ad-studio:stock] search_complete', { candidateCount: hits.length })
    return selectStockHit(hits, query, durationSec, aspect)
  } catch (err) {
    console.warn('[ad-studio:stock] search_unavailable', { type: err instanceof Error ? err.name : 'unknown' })
    return null
  }
}

/** Paid-generation confirmation precedes stock transfer; signed URLs never leave this function. */
export async function materializeStockScene(input: { runId: string; sceneIndex: number; providerId: string; query: string; sourceInMs: number; sourceOutMs: number }): Promise<string> {
  console.info('[ad-studio:stock] materialize_begin', { runId: input.runId, sceneIndex: input.sceneIndex, providerId: input.providerId })
  if (input.sourceOutMs <= input.sourceInMs || input.sourceInMs < 0)
    throw new AdStudioError('STOCK_ERROR', 'The stock trim is invalid. Please re-plan this ad.')
  let hit = await findCachedHit(input.providerId)
  if (!hit) {
    console.info('[ad-studio:stock] cached_hit_expired', { runId: input.runId, sceneIndex: input.sceneIndex })
    if (input.query) await searchVideos(input.query, 1)
    hit = await findCachedHit(input.providerId)
  }
  if (!hit || hit.providerId !== input.providerId || input.sourceOutMs > hit.durationS * 1000) {
    throw new AdStudioError('STOCK_ERROR', 'The selected stock clip is no longer available. Please re-plan.')
  }
  try {
    const cached = await ensureStockAsset(hit)
    console.info('[ad-studio:stock] materialize_complete', { runId: input.runId, sceneIndex: input.sceneIndex, stockAssetId: cached.asset.id })
    return cached.asset.id
  } catch (err) {
    console.error('[ad-studio:stock] materialize_failed', { runId: input.runId, sceneIndex: input.sceneIndex, errorType: err instanceof Error ? err.name : 'unknown' })
    throw new AdStudioError('STOCK_ERROR', 'The stock footage could not be prepared. Please try re-planning.')
  }
}
