import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export type PixabayHitPublic = {
  providerId: string
  pageUrl: string
  author: string
  authorId: string
  tags: string
  durationS: number
  thumbUrl: string
  preview: string
  width: number
  height: number
}

type PixabayHitInternal = PixabayHitPublic & { srcUrl: string }

function cacheKey(q: string, page: number) {
  return `${q.toLowerCase().trim()}|${page}`
}

function pickSrc(videos: Record<string, { url?: string; width?: number; height?: number }>) {
  const large = videos.large
  if (large?.url && (large.width ?? 0) > 0) return large
  return videos.medium
}

function mapHit(raw: Record<string, unknown>): PixabayHitInternal | null {
  const id = raw.id
  if (id === undefined) return null
  const videos = raw.videos as Record<string, { url?: string; width?: number; height?: number; thumbnail?: string }>
  const src = pickSrc(videos || {})
  if (!src?.url) return null
  const tiny = videos.tiny
  return {
    providerId: String(id),
    pageUrl: String(raw.pageURL || ''),
    author: String(raw.user || ''),
    authorId: String(raw.user_id || ''),
    tags: String(raw.tags || ''),
    durationS: Number(raw.duration || 0),
    thumbUrl: String(tiny?.thumbnail || videos.small?.thumbnail || ''),
    preview: String(tiny?.url || videos.small?.url || ''),
    width: Number(src.width || 0),
    height: Number(src.height || 0),
    srcUrl: String(src.url),
  }
}

function sortHits(hits: PixabayHitInternal[]) {
  return [...hits].sort((a, b) => {
    const ap = a.height > a.width ? 1 : 0
    const bp = b.height > b.width ? 1 : 0
    if (bp !== ap) return bp - ap
    const ad = a.durationS >= 3 ? 1 : 0
    const bd = b.durationS >= 3 ? 1 : 0
    return bd - ad
  })
}

export async function searchVideos(q: string, page = 1): Promise<PixabayHitPublic[]> {
  const key = process.env.PIXABAY_API_KEY?.trim()
  if (!key) throw new Error('PIXABAY_API_KEY is not configured')

  const query = q.slice(0, 100)
  const ck = cacheKey(query, page)
  const prisma = getPrisma()
  const cached = await prisma.brollSearchCache.findUnique({ where: { q: ck } })
  if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_MS) {
    return (cached.json as PixabayHitPublic[]) || []
  }

  const url =
    `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}` +
    `&q=${encodeURIComponent(query)}&per_page=24&page=${page}&safesearch=true&video_type=film`

  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    console.error('[pixabay] search request failed', err instanceof Error ? err.message : err)
    throw new Error('Pixabay search failed')
  }
  if (!res.ok) {
    console.error('[pixabay] search http', res.status)
    throw new Error('Pixabay search failed')
  }

  const body = (await res.json()) as { hits?: Record<string, unknown>[] }
  const mapped = (body.hits || []).map(mapHit).filter(Boolean) as PixabayHitInternal[]
  const sorted = sortHits(mapped)
  const publicHits: PixabayHitPublic[] = sorted.map(({ srcUrl: _s, ...h }) => h)

  await prisma.brollSearchCache.upsert({
    where: { q: ck },
    create: { q: ck, json: publicHits },
    update: { json: publicHits, createdAt: new Date() },
  })

  // stash src urls for ensureStockAsset lookup
  await prisma.brollSearchCache.upsert({
    where: { q: `${ck}#src` },
    create: { q: `${ck}#src`, json: sorted },
    update: { json: sorted, createdAt: new Date() },
  })

  return publicHits
}

export async function findCachedHit(providerId: string): Promise<PixabayHitInternal | null> {
  const prisma = getPrisma()
  const since = new Date(Date.now() - CACHE_TTL_MS)
  const rows = await prisma.brollSearchCache.findMany({
    where: { createdAt: { gte: since }, q: { endsWith: '#src' } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })
  for (const row of rows) {
    const hits = row.json as PixabayHitInternal[]
    if (!Array.isArray(hits)) continue
    const hit = hits.find((h) => h.providerId === providerId)
    if (hit) return hit
  }
  return null
}

export async function ensureStockAsset(hit: PixabayHitInternal) {
  const prisma = getPrisma()
  const storage = getClipStorage()
  const objectKey = `stock/pixabay/${hit.providerId}.mp4`

  const existing = await prisma.stockAsset.findUnique({
    where: { provider_providerId: { provider: 'pixabay', providerId: hit.providerId } },
  })
  if (existing?.storageKey) {
    const url = await storage.createSignedDownloadUrl(existing.storageKey, 3600)
    return { asset: existing, url }
  }

  const row =
    existing ??
    (await prisma.stockAsset.create({
      data: {
        provider: 'pixabay',
        providerId: hit.providerId,
        pageUrl: hit.pageUrl,
        author: hit.author,
        authorId: hit.authorId,
        tags: hit.tags,
        width: hit.width,
        height: hit.height,
        durationS: hit.durationS,
        thumbUrl: hit.thumbUrl,
      },
    }))

  if (!row.storageKey) {
    const res = await fetch(hit.srcUrl)
    if (!res.ok) throw new Error('Failed to download stock video')
    const buf = Buffer.from(await res.arrayBuffer())
    const { supabase, bucket } = await import('@/lib/storage/supabase-driver').then((m) => {
      const c = m.getSupabaseStorageConfig()
      if (!c) throw new Error('storage not configured')
      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js')
      return {
        supabase: createClient(c.url, c.key, { auth: { persistSession: false } }),
        bucket: c.bucket,
      }
    })
    const { error } = await supabase.storage.from(bucket).upload(objectKey, buf, {
      contentType: 'video/mp4',
      upsert: true,
    })
    if (error) throw new Error(error.message)
    const updated = await prisma.stockAsset.update({
      where: { id: row.id },
      data: { storageKey: objectKey },
    })
    const url = await storage.createSignedDownloadUrl(objectKey, 3600)
    return { asset: updated, url }
  }

  const url = await storage.createSignedDownloadUrl(row.storageKey, 3600)
  return { asset: row, url }
}
