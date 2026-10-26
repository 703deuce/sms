import 'server-only'

import { randomUUID } from 'crypto'

import type { BrollItem } from '@/lib/clips/broll'
import { outputDurationMs, type ClipEditsV2, type ClipWord } from '@/lib/clips/edits'
import { wordsAfterEdits } from '@/lib/clips/edits'
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
  const existing = (edits.broll || []).map((b) => ({ startMs: b.startMs, endMs: b.endMs }))
  const occupied = [...existing]

  const placements = await suggestAutoBrollPlacements({
    clipTitle: options.clipTitle || 'Clip',
    words,
    outputDurationMs: outDur,
  })

  const items: BrollItem[] = []
  const queriesUsed: string[] = []
  let attempted = 0

  for (const p of placements) {
    if (items.length >= 3) break
    attempted += 1
    const startMs = p.atMs
    const endMs = Math.min(outDur - END_PAD_MS, startMs + p.durationMs)
    if (endMs - startMs < 2000) continue
    if (overlapsAny(startMs, endMs, occupied)) continue

    try {
      const hits = await searchVideos(p.query, 1)
      const ranked = filterAndRankPixabayHits(hits, p.query, p.must_include)
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
      queriesUsed.push(p.query)
    } catch {
      /* skip failed placement */
    }
  }

  return { items, attempted, placed: items.length, queriesUsed }
}
