import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import type { StockCandidate } from '@/lib/server/t2v/stock-match'

/**
 * Provider-agnostic copy of pixabay.ts ensureStockAsset (Pexels + Pixabay), storing via the
 * ACTIVE clip storage driver (putBytes) — prod STORAGE_DRIVER is s3/B2 and the worker downloads from it.
 * StockAsset is unique on (provider, providerId) (existing model).
 */
export async function ensureStockAsset(_workspaceId: string, c: StockCandidate) {
  const prisma = getPrisma()
  const storage = getClipStorage()
  const objectKey = `stock/${c.provider}/${c.providerId}.mp4`
  const existing = await prisma.stockAsset.findUnique({ where: { provider_providerId: { provider: c.provider, providerId: c.providerId } } })
  if (existing?.storageKey) return existing
  const row = existing ?? (await prisma.stockAsset.create({ data: {
    provider: c.provider, providerId: c.providerId, pageUrl: c.pageUrl, author: c.author, authorId: null,
    tags: c.tags.join(', '), width: c.width, height: c.height, durationS: c.durationS, thumbUrl: c.thumbUrl,
  } }))
  const res = await fetch(c.srcUrl) // Pexels: video_files[].link ; Pixabay: videos.medium.url (no hotlinking -> copy)
  if (!res.ok) throw new Error(`stock_download_${res.status}`)
  await storage.putBytes(objectKey, Buffer.from(await res.arrayBuffer()), 'video/mp4')
  return prisma.stockAsset.update({ where: { id: row.id }, data: { storageKey: objectKey } })
}
