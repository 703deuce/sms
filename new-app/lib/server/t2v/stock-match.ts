import 'server-only'
import { createHash } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import {
  pexelsConfigured,
  pexelsSearchPhotos,
  pexelsSearchVideos,
  pickPexelsFile,
  type PexelsPhoto,
  type PexelsVideo,
} from '@/lib/server/ai/pexels'
import type { T2vStockMediaType } from '@/lib/t2v/m9-contracts'
import type { T2vAspect, T2vSceneMedia } from '@/lib/t2v/types'

export type StockCandidate = {
  provider: 'pixabay' | 'pexels' | 'pexels_photo'
  providerId: string
  width: number
  height: number
  durationS: number
  thumbUrl: string
  previewUrl: string
  srcUrl: string
  pageUrl: string
  author: string
  tags: string[]
  score: number
  /** video (default) or still photo (Pexels photos API) */
  stockKind?: 'video' | 'photo'
}

const TTL_MS = 24 * 60 * 60 * 1000

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'your',
  'this',
  'that',
  'from',
  'into',
  'about',
  'video',
  'scene',
  'clip',
  'stock',
  'footage',
  'show',
  'showing',
])

/** Primary stock search string: visual description + scene keywords (not generic script filler). */
export function buildSceneStockQuery(visualQuery: string, keywords: string[]): string {
  const vq = visualQuery.trim()
  const kw = keywords.map((k) => k.trim()).filter(Boolean)
  const parts = [vq, ...kw.filter((k) => !vq.toLowerCase().includes(k.toLowerCase()))]
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim()
  return joined.slice(0, 100) || vq.slice(0, 100)
}

/** When the LLM omits keywords, derive search terms from the visual query. */
export function extractSceneKeywords(visualQuery: string, keywords: string[]): string[] {
  const fromKw = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean)
  if (fromKw.length) return fromKw.slice(0, 6)
  return visualQuery
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 8)
}

function targetDims(aspect: T2vAspect) {
  return aspect === '9:16'
    ? { w: 1080, h: 1920 }
    : aspect === '1:1'
      ? { w: 1080, h: 1080 }
      : aspect === '4:5'
        ? { w: 1080, h: 1350 }
        : { w: 1920, h: 1080 }
}

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prisma = getPrisma()
  const q = `t2v|${createHash('sha1').update(key).digest('hex')}`
  const row = await prisma.brollSearchCache.findUnique({ where: { q } })
  if (row && Date.now() - row.createdAt.getTime() < TTL_MS) return row.json as T
  const json = await fn()
  await prisma.brollSearchCache.upsert({
    where: { q },
    create: { q, json: json as object },
    update: { json: json as object, createdAt: new Date() },
  })
  return json
}

async function pixabay(query: string, aspect: T2vAspect, page: number): Promise<StockCandidate[]> {
  const key = process.env.PIXABAY_API_KEY?.trim()
  if (!key) return []
  return cached(`pixabay|${query}|${aspect}|${page}`, async () => {
    const u = new URL('https://pixabay.com/api/videos/')
    u.searchParams.set('key', key)
    u.searchParams.set('q', query.slice(0, 100))
    u.searchParams.set('video_type', 'film')
    u.searchParams.set('safesearch', 'true')
    u.searchParams.set('per_page', '40')
    u.searchParams.set('page', String(page))
    u.searchParams.set(aspect === '9:16' ? 'min_height' : 'min_width', '1280')
    const res = await fetch(u, { signal: AbortSignal.timeout(15_000) })
    if (res.status === 429) throw new Error('pixabay_rate_limited')
    if (!res.ok) throw new Error(`pixabay_http_${res.status}`)
    const body = (await res.json()) as { hits?: Record<string, unknown>[] }
    return (body.hits ?? []).flatMap((hit) => {
      const v = (hit.videos ?? {}) as Record<string, { url?: string; width?: number; height?: number; thumbnail?: string }>
      const r = v.medium?.url ? v.medium : v.small?.url ? v.small : null
      if (!r?.url) return []
      return [{
        provider: 'pixabay' as const,
        providerId: String(hit.id),
        width: Number(r.width),
        height: Number(r.height),
        durationS: Number(hit.duration ?? 0),
        thumbUrl: String(v.tiny?.thumbnail ?? r.thumbnail ?? ''),
        previewUrl: String(v.tiny?.url ?? r.url),
        srcUrl: String(r.url),
        pageUrl: String(hit.pageURL ?? ''),
        author: String(hit.user ?? ''),
        tags: String(hit.tags ?? '')
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        score: 0,
      }]
    })
  })
}

async function pexelsPhotos(query: string, aspect: T2vAspect, page: number): Promise<StockCandidate[]> {
  if (!pexelsConfigured()) return []
  const orientation = aspect === '9:16' ? 'portrait' : aspect === '16:9' ? 'landscape' : 'square'
  return cached(`pexels-photo|${query}|${aspect}|${page}`, async () => {
    const { photos } = await pexelsSearchPhotos({ query, orientation, page, perPage: 40 })
    return photos.flatMap((p: PexelsPhoto) => {
      const src = p.src.large2x || p.src.large || p.src.medium
      if (!src) return []
      return [{
        provider: 'pexels_photo' as const,
        providerId: String(p.id),
        width: p.width,
        height: p.height,
        durationS: 0,
        thumbUrl: p.src.medium || src,
        previewUrl: src,
        srcUrl: src,
        pageUrl: p.url,
        author: p.photographer,
        tags: query.toLowerCase().split(/\s+/).filter(Boolean),
        score: 0,
        stockKind: 'photo' as const,
      }]
    })
  })
}

async function pexels(query: string, aspect: T2vAspect, page: number): Promise<StockCandidate[]> {
  if (!pexelsConfigured()) return []
  const { w, h } = targetDims(aspect)
  return cached(`pexels|${query}|${aspect}|${page}`, async () => {
    const orientation = aspect === '9:16' ? 'portrait' : aspect === '16:9' ? 'landscape' : 'square'
    const { videos } = await pexelsSearchVideos({ query, orientation, size: 'medium', page, perPage: 40 })
    return videos.flatMap((v: PexelsVideo) => {
      const f = pickPexelsFile(v, w, h)
      if (!f) return []
      return [{
        provider: 'pexels' as const,
        providerId: String(v.id),
        width: f.width ?? v.width,
        height: f.height ?? v.height,
        durationS: v.duration,
        thumbUrl: v.image,
        previewUrl: (v.video_files.find((x) => x.quality === 'sd') ?? f).link,
        srcUrl: f.link,
        pageUrl: v.url,
        author: v.user.name,
        tags: (v.url.split('/video/')[1] ?? '').replace(/-\d+\/?$/, '').split('-').filter(Boolean),
        score: 0,
      }]
    })
  })
}

export function scoreCandidate(
  c: StockCandidate,
  o: { keywords: string[]; aspect: T2vAspect; needS: number },
): number {
  const kw = o.keywords.map((k) => k.toLowerCase()).filter(Boolean)
  const tagText = `${c.tags.join(' ')}`.toLowerCase()
  const overlap = kw.length
    ? kw.filter((k) => tagText.includes(k) || c.tags.some((t) => t.includes(k) || k.includes(t))).length /
      kw.length
    : 0
  const portrait = c.height > c.width
  const square = Math.abs(c.width - c.height) / Math.max(c.width, c.height) < 0.1
  const orient =
    o.aspect === '9:16'
      ? portrait
        ? 1
        : 0.35
      : o.aspect === '16:9'
        ? !portrait && !square
          ? 1
          : 0.3
        : square
          ? 1
          : 0.6
  const dur = c.durationS >= o.needS ? 1 : c.durationS / Math.max(1, o.needS)
  const { w, h } = targetDims(o.aspect)
  const res = Math.min(1, Math.max(c.width, c.height) / Math.max(w, h))
  const prior = c.provider === 'pexels' ? 1 : 0.85
  const tooLong = c.durationS > 60 ? 0.05 : 0
  return 0.35 * overlap + 0.25 * orient + 0.2 * dur + 0.1 * res + 0.1 * prior - tooLong
}

export async function matchScenes(input: {
  scenes: { id: string; visualQuery: string; keywords: string[]; needMs: number }[]
  aspect: T2vAspect
  sources: Array<'pexels' | 'pixabay'>
}): Promise<Record<string, { pick: StockCandidate | null; alternates: StockCandidate[] }>> {
  const used = new Set<string>()
  const out: Record<string, { pick: StockCandidate | null; alternates: StockCandidate[] }> = {}
  for (const s of input.scenes) {
    const kw = extractSceneKeywords(s.visualQuery, s.keywords)
    const primary = buildSceneStockQuery(s.visualQuery, s.keywords)
    const queries = [primary, s.visualQuery.trim(), kw.slice(0, 3).join(' ')].filter(
      (q, i, a) => q && a.indexOf(q) === i,
    )
    let pool: StockCandidate[] = []
    for (const q of queries) {
      const batches = await Promise.allSettled([
        input.sources.includes('pexels') ? pexels(q, input.aspect, 1) : Promise.resolve([]),
        input.sources.includes('pixabay') ? pixabay(q, input.aspect, 1) : Promise.resolve([]),
      ])
      for (const b of batches) if (b.status === 'fulfilled') pool.push(...b.value)
      if (pool.length >= 12) break
    }
    const seen = new Set<string>()
    pool = pool
      .filter((c) => {
        const id = `${c.provider}:${c.providerId}`
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      .map((c) => ({
        ...c,
        score: scoreCandidate(c, { keywords: kw, aspect: input.aspect, needS: s.needMs / 1000 }),
      }))
      .sort((a, b) => b.score - a.score)
    const pick = pool.find((c) => !used.has(`${c.provider}:${c.providerId}`)) ?? pool[0] ?? null
    if (pick) used.add(`${pick.provider}:${pick.providerId}`)
    out[s.id] = { pick, alternates: pool.filter((c) => c !== pick).slice(0, 23) }
  }
  return out
}

export function trimWindow(clipS: number, needS: number): { srcInMs: number; loops: boolean } {
  if (clipS <= needS + 0.5) return { srcInMs: 0, loops: clipS < needS }
  const start = Math.max(0.5, (clipS - needS) / 2)
  return { srcInMs: Math.round(start * 1000), loops: false }
}

/** Single-scene search for Replace-media drawer (GET …/scenes/[id]/media). */
export async function searchT2vStock(input: {
  query: string
  aspect: T2vAspect
  sources: Array<'pexels' | 'pixabay'>
  page: number
  keywords?: string[]
  needMs?: number
  /** Agent B: `photo` uses Pexels photos API when keyed; until then returns [] */
  mediaType?: T2vStockMediaType
}): Promise<StockCandidate[]> {
  const kw = extractSceneKeywords(input.query, input.keywords ?? [])
  if (input.mediaType === 'photo') {
    if (!input.sources.includes('pexels')) return []
    const pool = await pexelsPhotos(input.query, input.aspect, input.page)
    const needS = (input.needMs ?? 5000) / 1000
    return pool
      .map((c) => ({
        ...c,
        score: scoreCandidate(c, { keywords: kw, aspect: input.aspect, needS }),
      }))
      .sort((a, b) => b.score - a.score)
  }
  const batches = await Promise.allSettled([
    input.sources.includes('pexels') ? pexels(input.query, input.aspect, input.page) : Promise.resolve([]),
    input.sources.includes('pixabay') ? pixabay(input.query, input.aspect, input.page) : Promise.resolve([]),
  ])
  const pool: StockCandidate[] = []
  for (const b of batches) if (b.status === 'fulfilled') pool.push(...b.value)
  const needS = (input.needMs ?? 5000) / 1000
  return pool
    .map((c) => ({
      ...c,
      score: scoreCandidate(c, { keywords: kw, aspect: input.aspect, needS }),
    }))
    .sort((a, b) => b.score - a.score)
}

export function toSceneMedia(
  c: StockCandidate,
  assetId: string | undefined,
  needMs: number,
  query: string,
): T2vSceneMedia {
  const isPhoto = c.stockKind === 'photo'
  const { srcInMs } = isPhoto ? { srcInMs: 0 } : trimWindow(c.durationS, needMs / 1000)
  const mediaProvider: 'pexels' | 'pixabay' =
    c.provider === 'pexels_photo' || c.provider === 'pexels' ? 'pexels' : 'pixabay'
  return {
    provider: mediaProvider,
    kind: isPhoto ? 'image' : 'video',
    ...(assetId && assetId !== 'pending' ? { assetId } : {}),
    providerId: c.providerId,
    thumbUrl: c.thumbUrl,
    previewUrl: c.previewUrl,
    width: c.width,
    height: c.height,
    durationMs: Math.round(c.durationS * 1000),
    srcInMs,
    focalX: 0.5,
    focalY: 0.5,
    attribution: { author: c.author, pageUrl: c.pageUrl, provider: mediaProvider },
    query,
  }
}
