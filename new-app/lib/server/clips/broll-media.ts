import 'server-only'

import type { BrollItem } from '@/lib/clips/broll'
import { findCachedHit } from '@/lib/server/ai/pixabay'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'

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
  const storage = getClipStorage()
  const out: BrollMediaRow[] = []

  for (const item of items) {
    if (item.source === 'stock') {
      const asset = await prisma.stockAsset.findUnique({ where: { id: item.assetId } })
      if (!asset) continue
      let url = asset.storageKey ? await storage.createSignedDownloadUrl(asset.storageKey, 3600) : null
      if (!url) {
        const hit = await findCachedHit(asset.providerId)
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
      if (!gen?.storageKey) continue
      const url = await storage.createSignedDownloadUrl(gen.storageKey, 3600)
      out.push({
        id: item.id,
        source: 'ai',
        startMs: item.startMs,
        endMs: item.endMs,
        url,
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
