import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import type { StockCandidate } from '@/lib/server/t2v/stock-match'

const ALLOWED_STOCK_HOSTS = new Set([
  'videos.pexels.com',
  'images.pexels.com',
  'player.vimeo.com',
  'cdn.pixabay.com',
  'pixabay.com',
])

function stockProviderKey(c: StockCandidate): { provider: string; providerId: string } {
  if (c.stockKind === 'photo' && c.provider === 'pexels') {
    return { provider: 'pexels_photo', providerId: c.providerId }
  }
  return { provider: c.provider, providerId: c.providerId }
}

function assertAllowedStockUrl(srcUrl: string) {
  const host = new URL(srcUrl).hostname.toLowerCase()
  const ok = [...ALLOWED_STOCK_HOSTS].some((h) => host === h || host.endsWith(`.${h}`))
  if (!ok) throw new Error('stock_url_not_allowed')
}

/**
 * Copy provider renditions into clip storage via the active driver (B2/S3/local).
 * Only server-resolved CDN URLs from stock search may be fetched.
 */
export async function ensureT2vStockAsset(_workspaceId: string, c: StockCandidate) {
  const prisma = getPrisma()
  const storage = getClipStorage()
  const { provider, providerId } = stockProviderKey(c)
  const isPhoto = c.stockKind === 'photo'
  const objectKey = `stock/${provider}/${providerId}.${isPhoto ? 'jpg' : 'mp4'}`
  const existing = await prisma.stockAsset.findUnique({
    where: { provider_providerId: { provider, providerId } },
  })
  if (existing?.storageKey) return existing

  assertAllowedStockUrl(c.srcUrl)

  const row =
    existing ??
    (await prisma.stockAsset.create({
      data: {
        provider,
        providerId,
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
