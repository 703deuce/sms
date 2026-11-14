import 'server-only'
import { searchT2vStock, type StockCandidate } from '@/lib/server/t2v/stock-match'
import { pexelsConfigured } from '@/lib/server/ai/pexels'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vAspect } from '@/lib/t2v/types'
import type { T2vFootageCandidate, T2vPlannedShot } from '@/lib/t2v/pipeline/t2v-types'

/**
 * Footage Researcher (Prompt-to-Video only). Bounded: <= 8 candidates per shot go to the visual reviewer.
 *
 * Own Pixabay search, tuned after the first live run: the shared T2V search sends video_type=film, which
 * drops most EV/tech clips (Pixabay files many as "animation"), and Pixabay's plain multi-word search is
 * loose OR-ranking (an "electric car charging" query returned burgers and deserts). Here we try an AND query
 * first (words joined with "+"), fall back to the loose query, and rank every hit by how many query words
 * appear in its tags, so the reviewer only sees clips whose tags actually mention the subject.
 */
const MAX_PER_SHOT = 8
const MAX_QUERIES_PER_SHOT = 5
const MIN_SRC_WIDTH = 1280

const STOP = new Set(['the', 'and', 'with', 'into', 'from', 'for', 'over', 'onto', 'of', 'a', 'an', 'in', 'on', 'at', 'to', 'its', 'their'])

export function queryWords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
}

/**
 * Word matches a tag word when they share a stem: long words (5+ chars) by 5-char prefix (charging ~ charger),
 * short words only exactly or as a plural (car ~ cars, never cargo/cartridge/cable car's "cable").
 */
function stem(w: string): string {
  return w.length > 5 ? w.slice(0, 5) : w
}

function wordHits(w: string, tagWord: string): boolean {
  if (w.length <= 4 || tagWord.length <= 4) return tagWord === w || tagWord === `${w}s` || w === `${tagWord}s`
  const s = stem(w)
  const t = stem(tagWord)
  return t.startsWith(s) || s.startsWith(t)
}

export function tagOverlap(words: string[], tags: string[]): number {
  const tagWords = tags.flatMap((t) => t.toLowerCase().split(/[\s-]+/)).filter(Boolean)
  let n = 0
  for (const w of words) {
    if (w === 'ev' ? tags.some((t) => /\b(ev|e auto|electric vehicle|electric car)\b/i.test(t)) : tagWords.some((t) => wordHits(w, t))) n++
  }
  return n
}

type PixHit = Record<string, unknown>

/** Pixabay files CGI/animation as type "animation"; tags catch the rest (AI imagery, icons, loops). */
const NON_LIVE_TAG = /\b(animation|animated|anime|cartoon|3d|render|rendering|cgi|ai generated|ai-generated|generated|illustration|motion graphics?|graphic|icon|clip ?art|vector|infographic|abstract|particles|hologram|futuristic|concept car|sci-?fi)\b/i

export function looksNonLiveAction(hit: { type?: unknown; tags?: unknown }): boolean {
  if (String(hit.type ?? '').toLowerCase() === 'animation') return true
  return NON_LIVE_TAG.test(String(hit.tags ?? ''))
}

// Pixabay allows 100 requests / 60 s per key; stay under it and reuse identical queries within a run.
const pixCache = new Map<string, Promise<PixHit[]>>()
const pixCalls: number[] = []
async function pixThrottle() {
  for (;;) {
    const now = Date.now()
    while (pixCalls.length && now - pixCalls[0]! > 60_000) pixCalls.shift()
    if (pixCalls.length < 80) break
    await new Promise((r) => setTimeout(r, 1500))
  }
  pixCalls.push(Date.now())
}

function pixabayRaw(q: string, aspect: T2vAspect): Promise<PixHit[]> {
  const k = `${aspect}|${q}`
  let p = pixCache.get(k)
  if (!p) {
    p = pixabayFetch(q, aspect).catch((err) => {
      pixCache.delete(k)
      throw err
    })
    pixCache.set(k, p)
    if (pixCache.size > 500) pixCache.delete(pixCache.keys().next().value as string)
  }
  return p
}

async function pixabayFetch(q: string, aspect: T2vAspect): Promise<PixHit[]> {
  const key = process.env.PIXABAY_API_KEY?.trim()
  if (!key) return []
  await pixThrottle()
  const u = new URL('https://pixabay.com/api/videos/')
  u.searchParams.set('key', key)
  u.searchParams.set('q', q.slice(0, 100))
  u.searchParams.set('safesearch', 'true')
  u.searchParams.set('per_page', '50')
  u.searchParams.set(aspect === '9:16' ? 'min_height' : 'min_width', String(MIN_SRC_WIDTH))
  const res = await fetch(u, { signal: AbortSignal.timeout(15_000) })
  if (res.status === 429) throw new Error('pixabay_rate_limited')
  if (!res.ok) throw new Error(`pixabay_http_${res.status}`)
  const body = (await res.json()) as { hits?: PixHit[] }
  return body.hits ?? []
}

function fromPixabay(hit: PixHit, query: string): T2vFootageCandidate | null {
  const v = (hit.videos ?? {}) as Record<string, { url?: string; width?: number; height?: number; thumbnail?: string }>
  const src = v.large?.url ? v.large : v.medium?.url ? v.medium : v.small?.url ? v.small : null
  if (!src?.url) return null
  const preview = v.tiny?.url ? v.tiny : v.small?.url ? v.small : src
  return {
    provider: 'pixabay',
    providerId: String(hit.id),
    previewUrl: String(preview.url),
    durationS: Number(hit.duration ?? 0),
    width: Number(src.width ?? 0),
    height: Number(src.height ?? 0),
    query,
    tags: String(hit.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12),
    srcUrl: String(src.url),
    thumbUrl: String(v.tiny?.thumbnail ?? src.thumbnail ?? ''),
    pageUrl: String(hit.pageURL ?? ''),
    author: String(hit.user ?? ''),
  }
}

function orientationOk(c: { width: number; height: number }, aspect: T2vAspect): boolean {
  const portrait = c.height > c.width
  if (aspect === '9:16') return portrait || c.width / Math.max(1, c.height) < 1.9
  if (aspect === '16:9') return !portrait
  return true
}

function fromShared(c: StockCandidate, query: string): T2vFootageCandidate {
  return {
    provider: c.provider === 'pexels' ? 'pexels' : 'pixabay',
    providerId: c.providerId,
    previewUrl: c.previewUrl,
    durationS: c.durationS,
    width: c.width,
    height: c.height,
    query,
    tags: c.tags.slice(0, 12),
    srcUrl: c.srcUrl,
    thumbUrl: c.thumbUrl,
    pageUrl: c.pageUrl,
    author: c.author,
  }
}

type Ranked = { c: T2vFootageCandidate; overlap: number; words: number; qi: number; rank: number }

/** Rank a query's hits: tag overlap first (must be >= 1), then the provider's own order. */
async function searchQuery(query: string, qi: number, aspect: T2vAspect, realistic: boolean): Promise<Ranked[]> {
  const words = queryWords(query)
  if (!words.length) return []
  const seen = new Set<string>()
  const out: Ranked[] = []
  const add = (hits: PixHit[]) => {
    hits.forEach((h, rank) => {
      if (realistic && looksNonLiveAction(h)) return
      const c = fromPixabay(h, query)
      if (!c || seen.has(c.providerId)) return
      seen.add(c.providerId)
      out.push({ c, overlap: tagOverlap(words, c.tags), words: words.length, qi, rank })
    })
  }
  if (words.length > 1) add(await pixabayRaw(words.join('+'), aspect))
  if (out.filter((r) => r.overlap >= 1).length < 4) add(await pixabayRaw(words.join(' '), aspect))
  return out.filter((r) => r.overlap >= 1)
}

/** Planner queries plus broader rewrites (2-word cores, then the video topic) — de-duplicated, bounded. */
export function queryRewrites(queries: string[], topic: string): string[] {
  const out: string[] = []
  const push = (q: string) => {
    const w = queryWords(q).join(' ')
    if (w && !out.includes(w)) out.push(w)
  }
  queries.forEach(push)
  for (const q of queries) {
    const w = queryWords(q)
    if (w.length > 2) push(w.slice(-2).join(' '))
  }
  push(queryWords(topic).slice(0, 2).join(' '))
  return out.slice(0, MAX_QUERIES_PER_SHOT)
}

export async function t2vFootageAgent(input: {
  shots: T2vPlannedShot[]
  aspect: T2vAspect
  topic?: string
  /** Later rounds pass the rewriter's queries as-is (no extra rewrites). */
  rewrite?: boolean
  /** Live-action only (documentary-like styles). */
  realistic?: boolean
  /** providerIds already reviewed for a scene — never send them to the reviewer again. */
  exclude?: Record<string, string[]>
}): Promise<Record<string, T2vFootageCandidate[]>> {
  const usePexels = pexelsConfigured()
  const out: Record<string, T2vFootageCandidate[]> = {}
  const usedFirst = new Set<string>()
  let searches = 0
  for (const shot of input.shots) {
    const pool: Ranked[] = []
    const queries = input.rewrite === false ? shot.queries.slice(0, MAX_QUERIES_PER_SHOT) : queryRewrites(shot.queries, input.topic ?? '')
    const skip = new Set(input.exclude?.[shot.sceneId] ?? [])
    for (let qi = 0; qi < queries.length; qi++) {
      const query = queries[qi]!
      try {
        searches++
        pool.push(...(await searchQuery(query, qi, input.aspect, input.realistic !== false)))
        if (usePexels) {
          const px = await searchT2vStock({ query, aspect: input.aspect, sources: ['pexels'], page: 1, needMs: Math.round(shot.needS * 1000), videoTopic: '' })
          px.slice(0, 6).forEach((c, rank) => pool.push({ c: fromShared(c, query), overlap: 1, words: 1, qi, rank: rank + 50 }))
        }
      } catch (err) {
        logT2v('pipeline-footage', 'search failed', { sceneId: shot.sceneId, error: err instanceof Error ? err.message : 'error' })
      }
    }
    const usable = pool.filter((r) => !skip.has(r.c.providerId) && r.c.durationS >= shot.needS + 0.3 && r.c.durationS <= 75 && orientationOk(r.c, input.aspect))
    // Full tag match beats partial; earlier (more specific) queries beat later; then provider order.
    usable.sort((a, b) => b.overlap / b.words - a.overlap / a.words || a.qi - b.qi || a.rank - b.rank)
    const picks: T2vFootageCandidate[] = []
    const seen = new Set<string>()
    const pushFrom = (list: Ranked[]) => {
      for (const r of list) {
        const k = `${r.c.provider}:${r.c.providerId}`
        if (picks.length >= MAX_PER_SHOT || seen.has(k)) continue
        seen.add(k)
        picks.push(r.c)
      }
    }
    // Prefer clips no earlier shot leads with, then allow shared ones (the verifier dedupes accepted picks).
    pushFrom(usable.filter((r) => !usedFirst.has(`${r.c.provider}:${r.c.providerId}`)))
    pushFrom(usable)
    if (picks[0]) usedFirst.add(`${picks[0].provider}:${picks[0].providerId}`)
    out[shot.sceneId] = picks
  }
  logT2v('pipeline-footage', 'candidates ready', {
    shots: input.shots.length,
    searches,
    candidates: Object.values(out).reduce((n, l) => n + l.length, 0),
    emptyShots: Object.values(out).filter((l) => !l.length).length,
  })
  return out
}

/** Pixabay files real photos as image_type=photo; tags still catch AI/illustration uploads. */
const NON_PHOTO_TAG = /\b(illustration|vector|clip ?art|cartoon|drawing|3d|render|rendering|cgi|ai generated|ai-generated|generated|digital art|painting|icon|infographic|watercolor|sketch)\b/i

async function pixabayPhotoFetch(q: string, aspect: T2vAspect): Promise<PixHit[]> {
  const key = process.env.PIXABAY_API_KEY?.trim()
  if (!key) return []
  await pixThrottle()
  const u = new URL('https://pixabay.com/api/')
  u.searchParams.set('key', key)
  u.searchParams.set('q', q.slice(0, 100))
  u.searchParams.set('image_type', 'photo')
  u.searchParams.set('safesearch', 'true')
  u.searchParams.set('per_page', '30')
  u.searchParams.set('orientation', aspect === '9:16' ? 'vertical' : 'horizontal')
  u.searchParams.set(aspect === '9:16' ? 'min_height' : 'min_width', String(MIN_SRC_WIDTH))
  const res = await fetch(u, { signal: AbortSignal.timeout(15_000) })
  if (res.status === 429) throw new Error('pixabay_rate_limited')
  if (!res.ok) throw new Error(`pixabay_photo_http_${res.status}`)
  const body = (await res.json()) as { hits?: PixHit[] }
  return body.hits ?? []
}

export function photoFromPixabay(hit: PixHit, query: string): T2vFootageCandidate | null {
  const src = String(hit.largeImageURL ?? hit.webformatURL ?? '')
  const preview = String(hit.webformatURL ?? src)
  if (!src) return null
  return {
    provider: 'pixabay',
    kind: 'photo',
    // Own ID space: Pixabay photo and video IDs overlap.
    providerId: `img_${String(hit.id)}`,
    previewUrl: preview,
    // A still can fill any shot length (shown with a slow zoom/pan).
    durationS: 60,
    width: Number(hit.imageWidth ?? 0),
    height: Number(hit.imageHeight ?? 0),
    query,
    tags: String(hit.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12),
    srcUrl: src,
    thumbUrl: String(hit.previewURL ?? preview),
    pageUrl: String(hit.pageURL ?? ''),
    author: String(hit.user ?? ''),
  }
}

export function looksNonPhoto(hit: { tags?: unknown; type?: unknown }): boolean {
  const t = String(hit.type ?? 'photo').toLowerCase()
  return (t !== 'photo' && t !== '') || NON_PHOTO_TAG.test(String(hit.tags ?? ''))
}

/**
 * Photo fallback (after video rounds): Pixabay photos for the same queries, live-action photos only for
 * realistic styles, ranked by tag overlap. <= 4 per shot go to the same visual check (subject rule).
 */
export async function t2vPhotoAgent(input: {
  shots: T2vPlannedShot[]
  aspect: T2vAspect
  realistic?: boolean
  exclude?: Set<string>
}): Promise<Record<string, T2vFootageCandidate[]>> {
  const out: Record<string, T2vFootageCandidate[]> = {}
  for (const shot of input.shots) {
    const pool: Array<{ c: T2vFootageCandidate; overlap: number; words: number; qi: number; rank: number }> = []
    const queries = shot.queries.slice(0, 3)
    for (let qi = 0; qi < queries.length; qi++) {
      const words = queryWords(queries[qi]!)
      if (!words.length) continue
      try {
        const hits = await pixabayPhotoFetch(words.join(' '), input.aspect)
        hits.forEach((h, rank) => {
          if (input.realistic !== false && looksNonPhoto(h)) return
          const c = photoFromPixabay(h, queries[qi]!)
          if (!c || input.exclude?.has(c.providerId)) return
          pool.push({ c, overlap: tagOverlap(words, c.tags), words: words.length, qi, rank })
        })
      } catch (err) {
        logT2v('pipeline-footage', 'photo search failed', { sceneId: shot.sceneId, error: err instanceof Error ? err.message : 'error' })
      }
    }
    pool.sort((a, b) => b.overlap / b.words - a.overlap / a.words || a.qi - b.qi || a.rank - b.rank)
    const seen = new Set<string>()
    out[shot.sceneId] = pool
      .filter((r) => r.overlap >= 1 && !seen.has(r.c.providerId) && seen.add(r.c.providerId))
      .slice(0, 4)
      .map((r) => r.c)
  }
  logT2v('pipeline-footage', 'photo candidates ready', { shots: input.shots.length, candidates: Object.values(out).reduce((n, l) => n + l.length, 0) })
  return out
}
