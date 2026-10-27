import 'server-only'

import type { BrollItem } from '@/lib/clips/broll'
import { ensureStockAsset, findCachedHit } from '@/lib/server/ai/pixabay'
import { getPrisma } from '@/lib/server/db'
import { createSignedDownloadUrlForObjectKey } from '@/lib/storage'

export type BrollMediaRow = {
  id: string
  source: 'stock' | 'ai'
  startMs: number
  endMs: number
  url: string | null
  thumbUrl?: string
  author?: string
  pageUrl?: string
  generationId?: string
  assetId?: string
}

export async function resolveBrollMedia(items: BrollItem[]): Promise<BrollMediaRow[]> {
  const prisma = getPrisma()
  const out: BrollMediaRow[] = []

  for (const item of items) {
    if (item.source === 'stock') {
      const asset = await prisma.stockAsset.findUnique({ where: { id: item.assetId } })
      if (!asset) continue
      let url: string | null = null
      const hit = asset.provider === 'pixabay' ? await findCachedHit(asset.providerId) : null
      if (hit) {
        const ensured = await ensureStockAsset(hit)
        url = ensured.url
      } else if (asset.storageKey) {
        url = await createSignedDownloadUrlForObjectKey(asset.storageKey, undefined, 3600)
      }
      if (!url) {
        url = hit?.preview || hit?.srcUrl || null
      }
      const thumbUrl = asset.thumbUrl || (await findCachedHit(asset.providerId))?.thumbUrl
      out.push({
        id: item.id,
        source: 'stock',
        startMs: item.startMs,
        endMs: item.endMs,
        url,
        thumbUrl,
        author: asset.author,
        pageUrl: asset.pageUrl,
        assetId: asset.id,
      })
    } else {
      const gen = await prisma.aiGeneration.findUnique({ where: { id: item.generationId } })
      if (!gen) continue
      const params = (gen.params || {}) as { posterKey?: string }
      let url: string | null = null
      let thumbUrl: string | undefined
      if (gen.storageKey) {
        url = await createSignedDownloadUrlForObjectKey(gen.storageKey, undefined, 3600)
        thumbUrl = params.posterKey
          ? await createSignedDownloadUrlForObjectKey(params.posterKey, undefined, 3600)
          : url
      }
      out.push({
        id: item.id,
        source: 'ai',
        startMs: item.startMs,
        endMs: item.endMs,
        url,
        thumbUrl,
        generationId: gen.id,
      })
    }
  }
  return out
}

export async function stockCreditsForItems(items: BrollItem[]): Promise<string[]> {
  const prisma = getPrisma()
  const lines: string[] = []
  for (const item of items) {
    if (item.source !== 'stock') continue
    const asset = await prisma.stockAsset.findUnique({ where: { id: item.assetId } })
    if (!asset) continue
    lines.push(`Video by ${asset.author} on Pixabay ${asset.pageUrl}`)
  }
  return lines
}
