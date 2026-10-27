import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import type { StockCandidate } from '@/lib/server/t2v/stock-match'
import { logT2v, logT2vError } from '@/lib/server/t2v/log'

const ALLOWED_STOCK_HOST_SUFFIXES = [
  'videos.pexels.com',
  'images.pexels.com',
  'pexels.com',
  'player.vimeo.com',
  'vimeo.com',
  'cdn.pixabay.com',
  'pixabay.com',
] as const

const MAX_REDIRECTS = 5

function stockProviderKey(c: StockCandidate): { provider: string; providerId: string } {
  if (c.stockKind === 'photo' && c.provider === 'pexels') {
    return { provider: 'pexels_photo', providerId: c.providerId }
  }
  return { provider: c.provider, providerId: c.providerId }
}

function hostAllowedForStockFetch(host: string): boolean {
  const h = host.toLowerCase()
  return ALLOWED_STOCK_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`))
}

function assertAllowedStockUrl(srcUrl: string) {
  const u = new URL(srcUrl)
  if (u.protocol !== 'https:') throw new Error('stock_url_not_https')
  if (!hostAllowedForStockFetch(u.hostname)) throw new Error('stock_url_not_allowed')
}

async function fetchStockResponse(initialUrl: string): Promise<Response> {
  let url = initialUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowedStockUrl(url)
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(120_000) })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) throw new Error('stock_redirect_missing_location')
      url = new URL(loc, url).href
      continue
    }
    return res
  }
  throw new Error('stock_redirect_too_many')
}

async function stockObjectExists(storageKey: string): Promise<boolean> {
  const storage = getClipStorage()
  try {
    const size = await storage.getObjectSizeBytes(storageKey)
    return size != null && size > 0
  } catch {
    return false
  }
}

async function ingestStockBytes(
  objectKey: string,
  c: StockCandidate,
  rowId: string,
): Promise<{ id: string; storageKey: string | null }> {
  const prisma = getPrisma()
  const storage = getClipStorage()
  const isPhoto = c.stockKind === 'photo'
  assertAllowedStockUrl(c.srcUrl)
  logT2v('stock', 'ingest from provider', {
    assetId: rowId,
    provider: c.provider,
    providerId: c.providerId,
    storageKey: objectKey,
  })
  const res = await fetchStockResponse(c.srcUrl)
  if (!res.ok) throw new Error(`stock_download_${res.status}`)
  const contentType = isPhoto ? 'image/jpeg' : 'video/mp4'
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length < 64) throw new Error('stock_download_empty')
  await storage.putBytes(objectKey, bytes, contentType)
  return prisma.stockAsset.update({
    where: { id: rowId },
    data: { storageKey: objectKey },
  })
}

/**
 * Copy provider renditions into clip storage via the active driver (B2/S3/local).
 * Only server-resolved CDN URLs from stock search may be fetched.
 */
export async function ensureT2vStockAsset(_workspaceId: string, c: StockCandidate) {
  const prisma = getPrisma()
  const { provider, providerId } = stockProviderKey(c)
  const isPhoto = c.stockKind === 'photo'
  const objectKey = `stock/${provider}/${providerId}.${isPhoto ? 'jpg' : 'mp4'}`
  const existing = await prisma.stockAsset.findUnique({
    where: { provider_providerId: { provider, providerId } },
  })

  if (existing?.storageKey) {
    const ok = await stockObjectExists(existing.storageKey)
    if (ok) {
      logT2v('stock', 'reuse cached row', {
        assetId: existing.id,
        provider,
        providerId,
        storageKey: existing.storageKey,
      })
      return existing
    }
    logT2v('stock', 'storage object missing, re-ingest', {
      assetId: existing.id,
      provider,
      providerId,
      storageKey: existing.storageKey,
    })
    try {
      return await ingestStockBytes(existing.storageKey, c, existing.id)
    } catch (err) {
      logT2vError('stock', 're-ingest failed, clearing storageKey', err, {
        assetId: existing.id,
        provider,
        providerId,
      })
      await prisma.stockAsset.update({
        where: { id: existing.id },
        data: { storageKey: null },
      })
    }
  }

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

  return ingestStockBytes(objectKey, c, row.id)
}
