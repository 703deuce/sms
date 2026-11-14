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

/** Word matches a tag when either is a prefix of the other (charging ~ charger ~ charge via 5-char stem). */
function stem(w: string): string {
  return w.length > 5 ? w.slice(0, 5) : w
}

export function tagOverlap(words: string[], tags: string[]): number {
  const tagWords = tags.flatMap((t) => t.toLowerCase().split(/[\s-]+/)).map(stem)
  let n = 0
  for (const w of words) {
    const s = stem(w)
    if (w === 'ev' ? tags.some((t) => /\b(ev|e auto|electric vehicle|electric car)\b/i.test(t)) : tagWords.some((t) => t.startsWith(s) || s.startsWith(t))) n++
  }
  return n
}

type PixHit = Record<string, unknown>

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
async function searchQuery(query: string, qi: number, aspect: T2vAspect): Promise<Ranked[]> {
  const words = queryWords(query)
  if (!words.length) return []
  const seen = new Set<string>()
  const out: Ranked[] = []
  const add = (hits: PixHit[]) => {
    hits.forEach((h, rank) => {
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
}): Promise<Record<string, T2vFootageCandidate[]>> {
  const usePexels = pexelsConfigured()
  const out: Record<string, T2vFootageCandidate[]> = {}
  const usedFirst = new Set<string>()
  let searches = 0
  for (const shot of input.shots) {
    const pool: Ranked[] = []
    const queries = queryRewrites(shot.queries, input.topic ?? '')
    for (let qi = 0; qi < queries.length; qi++) {
      const query = queries[qi]!
      try {
        searches++
        pool.push(...(await searchQuery(query, qi, input.aspect)))
        if (usePexels) {
          const px = await searchT2vStock({ query, aspect: input.aspect, sources: ['pexels'], page: 1, needMs: Math.round(shot.needS * 1000), videoTopic: '' })
          px.slice(0, 6).forEach((c, rank) => pool.push({ c: fromShared(c, query), overlap: 1, words: 1, qi, rank: rank + 50 }))
        }
      } catch (err) {
        logT2v('pipeline-footage', 'search failed', { sceneId: shot.sceneId, error: err instanceof Error ? err.message : 'error' })
      }
    }
    const usable = pool.filter((r) => r.c.durationS >= shot.needS + 0.3 && r.c.durationS <= 75 && orientationOk(r.c, input.aspect))
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
