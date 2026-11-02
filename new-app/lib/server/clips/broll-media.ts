import 'server-only'

import type { BrollItem } from '@/lib/clips/broll'
import { isPendingStockAssetId, pendingStockProviderId } from '@/lib/clips/broll-auto-utils'
import { ensureStockAsset, findCachedHit } from '@/lib/server/ai/pixabay'
import { getPrisma } from '@/lib/server/db'
import { createReadableSignedUrl } from '@/lib/storage'

export type BrollMediaRow = {
  id: string
  source: 'stock' | 'ai' | 'upload'
  startMs: number
  endMs: number
  url: string | null
  thumbUrl?: string
  author?: string
  pageUrl?: string
  generationId?: string
  assetId?: string
  /** E5 upload B-roll (filled client-side from the project media library). */
  uploadId?: string
  mediaType?: 'video' | 'image'
}

export async function resolveBrollMedia(
  items: BrollItem[],
  options?: { materializeStock?: boolean },
): Promise<BrollMediaRow[]> {
  const prisma = getPrisma()
  const materializeStock = options?.materializeStock !== false
  const out: BrollMediaRow[] = []

  for (const item of items) {
    // E5: upload B-roll URLs come from the project media library (signed per project, client-side).
    if (item.source === 'upload') continue
    if (item.source === 'stock') {
      const pending = isPendingStockAssetId(item.assetId)
      const providerId = pending ? pendingStockProviderId(item.assetId) : undefined
      const asset = pending
        ? null
        : await prisma.stockAsset.findUnique({ where: { id: item.assetId } })
      if (!asset && !providerId) continue
      let url: string | null = null
      const hit =
        asset?.provider === 'pixabay'
          ? await findCachedHit(asset.providerId)
          : providerId
            ? await findCachedHit(providerId)
            : null
      if (hit && materializeStock && !pending) {
        const ensured = await ensureStockAsset(hit)
        url = ensured.url
      } else if (hit) {
        url = hit.preview || hit.srcUrl || null
      } else if (asset?.storageKey) {
        url = await createReadableSignedUrl(asset.storageKey, 3600)
      }
      const thumbUrl = asset?.thumbUrl || hit?.thumbUrl
      out.push({
        id: item.id,
        source: 'stock',
        startMs: item.startMs,
        endMs: item.endMs,
        url,
        thumbUrl,
        author: asset?.author,
        pageUrl: asset?.pageUrl,
        assetId: asset?.id ?? item.assetId,
      })
    } else {
      const gen = await prisma.aiGeneration.findUnique({ where: { id: item.generationId } })
      if (!gen) continue
      const params = (gen.params || {}) as { posterKey?: string }
      let url: string | null = null
      let thumbUrl: string | undefined
      if (gen.storageKey) {
        // E6fix: AI b-roll was written to Supabase by the Kie callback; sign where the object lives.
        url = await createReadableSignedUrl(gen.storageKey, 3600)
        thumbUrl = params.posterKey ? await createReadableSignedUrl(params.posterKey, 3600) : url
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
