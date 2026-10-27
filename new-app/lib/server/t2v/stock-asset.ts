import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import type { StockCandidate } from '@/lib/server/t2v/stock-match'

/**
 * Copy provider renditions into clip storage via the active driver (B2/S3/local).
 * Pixabay clipper path uses ensureStockAsset in pixabay.ts; T2V uses this for Pixabay + Pexels.
 */
export async function ensureT2vStockAsset(_workspaceId: string, c: StockCandidate) {
  const prisma = getPrisma()
  const storage = getClipStorage()
  const isPhoto = c.stockKind === 'photo'
  const objectKey = `stock/${c.provider}/${c.providerId}.${isPhoto ? 'jpg' : 'mp4'}`
  const existing = await prisma.stockAsset.findUnique({
    where: { provider_providerId: { provider: c.provider, providerId: c.providerId } },
  })
  if (existing?.storageKey) return existing

  const row =
    existing ??
    (await prisma.stockAsset.create({
      data: {
        provider: c.provider,
        providerId: c.providerId,
        pageUrl: c.pageUrl,
        author: c.author,
        authorId: null,
        tags: c.tags.join(', '),
        width: c.width,
        height: c.height,
        durationS: c.durationS,
        thumbUrl: c.thumbUrl,
      },
    }))

  const res = await fetch(c.srcUrl, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`stock_download_${res.status}`)
  await storage.putBytes(
    objectKey,
    Buffer.from(await res.arrayBuffer()),
    isPhoto ? 'image/jpeg' : 'video/mp4',
  )
  return prisma.stockAsset.update({
    where: { id: row.id },
    data: { storageKey: objectKey },
  })
}
