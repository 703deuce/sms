import 'server-only'

import { randomUUID } from 'crypto'

import type { BrollItem } from '@/lib/clips/broll'
import { outputDurationMs, type ClipEditsV2, type ClipWord } from '@/lib/clips/edits'
import { wordsAfterEdits } from '@/lib/clips/edits'
import { cleanPixabayQuery, manualBrollOccupied } from '@/lib/clips/broll-auto-utils'
import { filterAndRankPixabayHits } from '@/lib/clips/pixabay-rerank'
import { ensureStockAsset, findCachedHit, searchVideos } from '@/lib/server/ai/pixabay'
import { suggestAutoBrollPlacements } from '@/lib/server/clips/broll-auto-llm'

const END_PAD_MS = 1000
const GAP_MS = 400

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 - GAP_MS && b0 < a1 - GAP_MS
}

function overlapsAny(startMs: number, endMs: number, ranges: { startMs: number; endMs: number }[]): boolean {
  return ranges.some((r) => rangesOverlap(startMs, endMs, r.startMs, r.endMs))
}

export type AutoBrollBuildResult = {
  items: BrollItem[]
  attempted: number
  placed: number
  queriesUsed: string[]
}

export async function buildAutoBrollItems(
  edits: ClipEditsV2,
  sourceWords: ClipWord[],
  options: { clipTitle: string },
): Promise<AutoBrollBuildResult> {
  const { words } = wordsAfterEdits(sourceWords, edits)
  const outDur = outputDurationMs(edits)
  const occupied = manualBrollOccupied(edits.broll || [])

  const placements = await suggestAutoBrollPlacements({
    clipTitle: options.clipTitle || 'Clip',
    words,
    outputDurationMs: outDur,
  })

  const items: BrollItem[] = []
  const queriesUsed: string[] = []
  let attempted = 0

  for (const p of placements) {
    if (items.length >= 5) break
    attempted += 1
    const startMs = p.atMs
    const endMs = Math.min(outDur - END_PAD_MS, startMs + p.durationMs)
    if (endMs - startMs < 2000) continue
    if (overlapsAny(startMs, endMs, occupied)) continue

    const query = cleanPixabayQuery(p.query)
    if (!query) continue

    try {
      const hits = await searchVideos(query, 1)
      const ranked = filterAndRankPixabayHits(hits, query, p.must_include || [])
      const pub = ranked.find((h) => (h.durationS ?? 0) >= 3) || ranked[0]
      if (!pub) continue

      const internal = await findCachedHit(pub.providerId)
      if (!internal) continue
      const { asset } = await ensureStockAsset(internal)

      items.push({
        id: randomUUID(),
        source: 'stock',
        assetId: asset.id,
        startMs,
        endMs,
        placement: 'auto',
      })
      occupied.push({ startMs, endMs })
      queriesUsed.push(query)
    } catch (err) {
      console.warn('[clipper:broll] auto placement skipped', {
        query,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { items, attempted, placed: items.length, queriesUsed }
}
