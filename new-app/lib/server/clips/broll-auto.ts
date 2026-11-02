import 'server-only'

import { randomUUID } from 'crypto'

import type { BrollItem } from '@/lib/clips/broll'
import { outputDurationMs, type ClipEditsV2, type ClipWord } from '@/lib/clips/edits'
import { wordsAfterEdits } from '@/lib/clips/edits'
import { cleanPixabayQuery, manualBrollOccupied, PENDING_STOCK_ASSET_PREFIX } from '@/lib/clips/broll-auto-utils'
import { filterAndRankPixabayHits } from '@/lib/clips/pixabay-rerank'
import { findCachedHit, searchVideos } from '@/lib/server/ai/pixabay'
import { suggestAutoBrollPlacements, type AutoBrollPlacementDrop } from '@/lib/server/clips/broll-auto-llm'
import { getPrisma } from '@/lib/server/db'

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
  rawCount: number
  dropReasons: AutoBrollPlacementDrop[]
  providerError?: string
}

function providerErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/PIXABAY_API_KEY/i.test(msg)) return 'stock provider not configured'
  if (/Pixabay search failed/i.test(msg)) return 'stock search failed'
  return msg.slice(0, 200)
}

export async function buildAutoBrollItems(
  edits: ClipEditsV2,
  sourceWords: ClipWord[],
  options: { clipTitle: string; deferStockCache?: boolean },
): Promise<AutoBrollBuildResult> {
  const { words } = wordsAfterEdits(sourceWords, edits)
  const outDur = outputDurationMs(edits)
  const occupied = manualBrollOccupied(edits.broll || [])

  const { placements, rawCount, dropReasons } = await suggestAutoBrollPlacements({
    clipTitle: options.clipTitle || 'Clip',
    words,
    outputDurationMs: outDur,
  })

  const items: BrollItem[] = []
  const queriesUsed: string[] = []
  let attempted = 0
  let providerError: string | undefined
  const prisma = getPrisma()
  const deferCache = options.deferStockCache !== false

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

      let assetId: string
      if (deferCache) {
        const existing = await prisma.stockAsset.findUnique({
          where: { provider_providerId: { provider: 'pixabay', providerId: pub.providerId } },
          select: { id: true },
        })
        assetId = existing?.id ?? `${PENDING_STOCK_ASSET_PREFIX}${pub.providerId}`
      } else {
        const { ensureStockAsset } = await import('@/lib/server/ai/pixabay')
        const { asset } = await ensureStockAsset(internal)
        assetId = asset.id
      }

      items.push({
        id: randomUUID(),
        source: 'stock',
        assetId,
        startMs,
        endMs,
        placement: 'auto',
      })
      occupied.push({ startMs, endMs })
      queriesUsed.push(query)
    } catch (err) {
      const message = providerErrorMessage(err)
      if (!providerError) providerError = message
      console.warn('[clipper:broll] auto placement skipped', { query, message })
    }
  }

  return {
    items,
    attempted,
    placed: items.length,
    queriesUsed,
    rawCount,
    dropReasons,
    ...(providerError ? { providerError } : {}),
  }
}
