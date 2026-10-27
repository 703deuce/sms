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
import { logT2v } from '@/lib/server/t2v/log'
import { geminiVisionConfigured } from '@/lib/server/ai/gemini-flash-lite'
import { batchStockVisionPick, type StockVisionBatchMetrics } from '@/lib/server/t2v/stock-match-vision'
import { narrationVisualFallback, normalizeVisualQuery } from '@/lib/server/t2v/visual-query'

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
  relevance?: number
  stockKind?: 'video' | 'photo'
}

const TTL_MS = 24 * 60 * 60 * 1000
/** Bump when query/scoring logic changes so broll_search_cache does not serve stale pools. */
const STOCK_CACHE_VERSION = 'v4-literal-visual-topic'

const MIN_RELEVANCE = 0.22

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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/** Whole-word / whole-tag overlap (avoids "sea" matching "research"). */
export function keywordTagRelevance(keywords: string[], tags: string[]): number {
  const tagTokens = new Set<string>()
  for (const tag of tags) {
    const t = tag.toLowerCase().trim()
    if (!t) continue
    tagTokens.add(t)
    for (const w of tokenize(t)) tagTokens.add(w)
  }
  if (!keywords.length) return 0
  let hits = 0
  for (const raw of keywords) {
    const k = raw.toLowerCase().trim()
    if (!k) continue
    const parts = k.split(/\s+/).filter((p) => p.length > 2)
    if (parts.length > 1) {
      if (parts.every((p) => tagTokens.has(p))) hits++
      continue
    }
    if (tagTokens.has(k)) hits++
  }
  return hits / keywords.length
}

export function withVideoTopic(query: string, videoTopic: string): string {
  const t = videoTopic.trim()
  const q = query.trim()
  if (!t) return q.slice(0, 100)
  if (!q) return t.slice(0, 100)
  if (q.toLowerCase().includes(t.toLowerCase())) return q.slice(0, 100)
  return `${t} ${q}`.replace(/\s+/g, ' ').trim().slice(0, 100)
}

/** Primary stock search string: video topic + visual description + scene keywords. */
export function buildSceneStockQuery(visualQuery: string, keywords: string[], videoTopic = ''): string {
  const vq = visualQuery.trim()
  const topic = videoTopic.trim()
  const kw = keywords.map((k) => k.trim()).filter(Boolean)
  const parts: string[] = []
  if (topic) parts.push(topic)
  if (vq) parts.push(vq)
  for (const k of kw) {
    if (!parts.some((p) => p.toLowerCase().includes(k.toLowerCase()))) parts.push(k)
  }
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim()
  return joined.slice(0, 100) || vq.slice(0, 100) || topic.slice(0, 100)
}

export function extractSceneKeywords(visualQuery: string, keywords: string[]): string[] {
  const fromKw = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean)
  if (fromKw.length) return fromKw.slice(0, 8)
  return tokenize(visualQuery).slice(0, 8)
}

export function mergeScoreKeywords(videoTopic: string, visualQuery: string, keywords: string[]): string[] {
  const topic = extractSceneKeywords(videoTopic, [])
  const scene = extractSceneKeywords(visualQuery, keywords)
  return [...new Set([...topic, ...scene])]
}

/** How many topic title tokens appear as whole words in clip tags. */
export function topicAnchorRelevance(videoTopic: string, tags: string[]): number {
  const topicTokens = tokenize(videoTopic)
  if (!topicTokens.length) return 1
  let hits = 0
  for (const t of topicTokens) {
    if (keywordTagRelevance([t], tags) > 0) hits++
  }
  return hits / topicTokens.length
}

/** Every fallback query includes the video topic — never generic keyword-only searches. */
export function buildTopicAnchoredQueries(input: {
  videoTopic: string
  visualQuery: string
  keywords: string[]
  narration?: string
}): string[] {
  const topic = input.videoTopic.trim()
  const vq = normalizeVisualQuery(input.visualQuery, topic)
  const kw = extractSceneKeywords(vq, input.keywords)
  const topicTok = tokenize(topic).slice(0, 4)
  const queries = [
    buildSceneStockQuery(vq, input.keywords, topic),
    withVideoTopic(vq, topic),
    withVideoTopic(`${topicTok.join(' ')} ${kw.slice(0, 4).join(' ')}`, topic),
    withVideoTopic(kw.slice(0, 4).join(' '), topic),
  ]
  if (input.narration?.trim()) {
    queries.push(narrationVisualFallback(input.narration, topic))
  }
  return queries.filter((q, i, a) => q.length > 3 && a.indexOf(q) === i)
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
  const q = `t2v|${STOCK_CACHE_VERSION}|${createHash('sha1').update(key).digest('hex')}`
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
    u.searchParams.set(aspect === '9:16' ? 'min_height' : 'min_width', '1920')
    const res = await fetch(u, { signal: AbortSignal.timeout(15_000) })
    if (res.status === 429) throw new Error('pixabay_rate_limited')
    if (!res.ok) throw new Error(`pixabay_http_${res.status}`)
    const body = (await res.json()) as { hits?: Record<string, unknown>[] }
    return (body.hits ?? []).flatMap((hit) => {
      const v = (hit.videos ?? {}) as Record<string, { url?: string; width?: number; height?: number; thumbnail?: string }>
      const r = v.large?.url ? v.large : v.medium?.url ? v.medium : v.small?.url ? v.small : null
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
  const queryTags = tokenize(query)
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
        tags: queryTags,
        score: 0,
        stockKind: 'photo' as const,
      }]
    })
  })
}

async function pexels(query: string, aspect: T2vAspect, page: number): Promise<StockCandidate[]> {
  if (!pexelsConfigured()) return []
  const { w, h } = targetDims(aspect)
  const queryTags = tokenize(query)
  return cached(`pexels|${query}|${aspect}|${page}`, async () => {
    const orientation = aspect === '9:16' ? 'portrait' : aspect === '16:9' ? 'landscape' : 'square'
    const { videos } = await pexelsSearchVideos({ query, orientation, size: 'large', page, perPage: 40 })
    return videos.flatMap((v: PexelsVideo) => {
      const f = pickPexelsFile(v, w, h)
      if (!f) return []
      const slugTags = (v.url.split('/video/')[1] ?? '').replace(/-\d+\/?$/, '').split('-').filter(Boolean)
      const tags = [...new Set([...queryTags, ...slugTags.map((t) => t.toLowerCase())])]
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
        tags,
        score: 0,
      }]
    })
  })
}

export function scoreCandidate(
  c: StockCandidate,
  o: { keywords: string[]; aspect: T2vAspect; needS: number; videoTopic?: string },
): number {
  const kwRel = keywordTagRelevance(o.keywords, c.tags)
  const topicRel = o.videoTopic ? topicAnchorRelevance(o.videoTopic, c.tags) : 1
  const relevance = kwRel * (0.3 + 0.7 * topicRel)
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
  c.relevance = relevance
  return 0.62 * relevance + 0.12 * orient + 0.1 * dur + 0.08 * res + 0.08 * prior - tooLong
}

function rankPool(
  pool: StockCandidate[],
  scoreKeywords: string[],
  aspect: T2vAspect,
  needS: number,
  videoTopic: string,
): StockCandidate[] {
  const seen = new Set<string>()
  return pool
    .filter((c) => {
      const id = `${c.provider}:${c.providerId}`
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map((c) => ({
      ...c,
      score: scoreCandidate(c, { keywords: scoreKeywords, aspect, needS, videoTopic }),
    }))
    .sort((a, b) => b.score - a.score)
}

function logSceneMatch(input: {
  sceneId: string
  query: string
  ranked: StockCandidate[]
  pick: StockCandidate | null
  lowRelevance: boolean
}) {
  logT2v('stock-match', 'scene ranked', {
    sceneId: input.sceneId,
    query: input.query,
    lowRelevance: input.lowRelevance,
    top: input.ranked.slice(0, 5).map((c) => ({
      provider: c.provider,
      providerId: c.providerId,
      score: Math.round(c.score * 1000) / 1000,
      relevance: Math.round((c.relevance ?? 0) * 1000) / 1000,
    })),
    pick: input.pick
      ? {
          provider: input.pick.provider,
          providerId: input.pick.providerId,
          score: input.pick.score,
          relevance: input.pick.relevance,
        }
      : null,
  })
}

async function fetchStockPoolForQuery(
  q: string,
  aspect: T2vAspect,
  sources: Array<'pexels' | 'pixabay'>,
): Promise<StockCandidate[]> {
  const batches = await Promise.allSettled([
    sources.includes('pexels') ? pexels(q, aspect, 1) : Promise.resolve([]),
    sources.includes('pixabay') ? pixabay(q, aspect, 1) : Promise.resolve([]),
  ])
  const pool: StockCandidate[] = []
  for (const b of batches) if (b.status === 'fulfilled') pool.push(...b.value)
  return pool
}

function eligibleVisionCandidates(
  ranked: StockCandidate[],
  used: Set<string>,
  limit = 5,
): StockCandidate[] {
  const eligible = ranked.filter(
    (c) => !used.has(`${c.provider}:${c.providerId}`) && (c.relevance ?? 0) >= MIN_RELEVANCE,
  )
  if (eligible.length >= 1) return eligible.slice(0, limit)
  return ranked.filter((c) => !used.has(`${c.provider}:${c.providerId}`)).slice(0, limit)
}

export type MatchScenesResult = {
  byScene: Record<string, { pick: StockCandidate | null; alternates: StockCandidate[] }>
  visionMetrics?: StockVisionBatchMetrics
}

export async function matchScenes(input: {
  scenes: {
    id: string
    visualQuery: string
    keywords: string[]
    needMs: number
    narration?: string
  }[]
  aspect: T2vAspect
  sources: Array<'pexels' | 'pixabay'>
  videoTopic: string
  workspaceId?: string
  projectId?: string
  /** Scene index offset when matching a subset (single-scene shuffle). */
  sceneIndexOffset?: number
}): Promise<MatchScenesResult> {
  const topic = input.videoTopic.trim()
  const used = new Set<string>()
  const out: Record<string, { pick: StockCandidate | null; alternates: StockCandidate[] }> = {}

  type SceneWork = {
    scene: (typeof input.scenes)[0]
    sceneIndex: number
    queries: string[]
    queryIdx: number
    ranked: StockCandidate[]
    usedQuery: string
    resolved: boolean
  }

  const work: SceneWork[] = input.scenes.map((s, i) => ({
    scene: s,
    sceneIndex: (input.sceneIndexOffset ?? 0) + i,
    queries: buildTopicAnchoredQueries({
      videoTopic: topic,
      visualQuery: s.visualQuery,
      keywords: s.keywords,
      narration: s.narration,
    }),
    queryIdx: 0,
    ranked: [],
    usedQuery: '',
    resolved: false,
  }))

  const visionEnabled = geminiVisionConfigured()
  let visionMetrics: StockVisionBatchMetrics | undefined
  const MAX_ROUNDS = 5

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const batchInputs: Array<{
      work: SceneWork
      eligible: StockCandidate[]
      query: string
    }> = []

    for (const w of work) {
      if (w.resolved) continue
      const scoreKeywords = mergeScoreKeywords(topic, w.scene.visualQuery, w.scene.keywords)
      while (w.queryIdx < w.queries.length) {
        const q = w.queries[w.queryIdx]
        const pool = await fetchStockPoolForQuery(q, input.aspect, input.sources)
        w.ranked = rankPool(pool, scoreKeywords, input.aspect, w.scene.needMs / 1000, topic)
        w.usedQuery = q
        const eligible = eligibleVisionCandidates(w.ranked, used)
        if (eligible.length > 0) {
          batchInputs.push({ work: w, eligible, query: q })
          break
        }
        w.queryIdx += 1
      }
      if (!w.resolved && w.queryIdx >= w.queries.length && w.ranked.length > 0 && batchInputs.every((b) => b.work !== w)) {
        const fallback =
          w.ranked.find((c) => !used.has(`${c.provider}:${c.providerId}`)) ?? w.ranked[0] ?? null
        if (fallback) used.add(`${fallback.provider}:${fallback.providerId}`)
        const lowRelevance = !fallback || (fallback.relevance ?? 0) < MIN_RELEVANCE
        logSceneMatch({
          sceneId: w.scene.id,
          query: w.usedQuery,
          ranked: w.ranked,
          pick: fallback,
          lowRelevance,
        })
        out[w.scene.id] = {
          pick: fallback,
          alternates: w.ranked.filter((c) => c !== fallback).slice(0, 23),
        }
        w.resolved = true
      }
    }

    if (batchInputs.length === 0) break

    const visionResults = new Map<string, { pickIndex: number | 'none'; scoreFallback: boolean }>()
    if (visionEnabled) {
      const { results, metrics } = await batchStockVisionPick({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        scenes: batchInputs.map((b) => ({
          sceneIndex: b.work.sceneIndex,
          sceneId: b.work.scene.id,
          videoTopic: topic,
          visualQuery: b.work.scene.visualQuery,
          narration: b.work.scene.narration ?? '',
          query: b.query,
          candidates: b.eligible,
        })),
      })
      if (!visionMetrics) visionMetrics = metrics
      else {
        visionMetrics.latencyMs += metrics.latencyMs
        visionMetrics.costUsdMicros += metrics.costUsdMicros
        visionMetrics.promptTokens += metrics.promptTokens
        visionMetrics.completionTokens += metrics.completionTokens
        visionMetrics.sceneCount += metrics.sceneCount
      }
      for (const r of results) {
        visionResults.set(r.sceneId, { pickIndex: r.pickIndex, scoreFallback: r.scoreFallback })
      }
    }

    for (const { work: w, eligible } of batchInputs) {
      const vr = visionResults.get(w.scene.id)
      let pick: StockCandidate | null = null
      if (!visionEnabled || !vr || vr.scoreFallback) {
        pick = eligible[0] ?? null
      } else if (vr.pickIndex === 'none') {
        w.queryIdx += 1
        continue
      } else {
        pick = eligible[vr.pickIndex] ?? eligible[0] ?? null
      }
      if (!pick) {
        w.queryIdx += 1
        continue
      }
      used.add(`${pick.provider}:${pick.providerId}`)
      const lowRelevance = (pick.relevance ?? 0) < MIN_RELEVANCE
      logSceneMatch({
        sceneId: w.scene.id,
        query: w.usedQuery,
        ranked: w.ranked,
        pick,
        lowRelevance,
      })
      out[w.scene.id] = { pick, alternates: w.ranked.filter((c) => c !== pick).slice(0, 23) }
      w.resolved = true
    }
  }

  for (const w of work) {
    if (w.resolved) continue
    const pick = w.ranked.find((c) => !used.has(`${c.provider}:${c.providerId}`)) ?? null
    if (pick) used.add(`${pick.provider}:${pick.providerId}`)
    logSceneMatch({
      sceneId: w.scene.id,
      query: w.usedQuery,
      ranked: w.ranked,
      pick,
      lowRelevance: true,
    })
    out[w.scene.id] = { pick, alternates: w.ranked.filter((c) => c !== pick).slice(0, 23) }
  }

  return { byScene: out, visionMetrics }
}

export function trimWindow(clipS: number, needS: number): { srcInMs: number; loops: boolean } {
  if (clipS <= needS + 0.5) return { srcInMs: 0, loops: clipS < needS }
  const start = Math.max(0.5, (clipS - needS) / 2)
  return { srcInMs: Math.round(start * 1000), loops: false }
}

export async function searchT2vStock(input: {
  query: string
  aspect: T2vAspect
  sources: Array<'pexels' | 'pixabay'>
  page: number
  keywords?: string[]
  needMs?: number
  mediaType?: T2vStockMediaType
  videoTopic?: string
}): Promise<StockCandidate[]> {
  const topic = input.videoTopic?.trim() ?? ''
  const q = withVideoTopic(input.query, topic)
  const scoreKeywords = mergeScoreKeywords(topic, input.query, input.keywords ?? [])
  const needS = (input.needMs ?? 5000) / 1000

  if (input.mediaType === 'photo') {
    if (!input.sources.includes('pexels')) return []
    const pool = await pexelsPhotos(q, input.aspect, input.page)
    return rankPool(pool, scoreKeywords, input.aspect, needS, topic)
  }
  const batches = await Promise.allSettled([
    input.sources.includes('pexels') ? pexels(q, input.aspect, input.page) : Promise.resolve([]),
    input.sources.includes('pixabay') ? pixabay(q, input.aspect, input.page) : Promise.resolve([]),
  ])
  const pool: StockCandidate[] = []
  for (const b of batches) if (b.status === 'fulfilled') pool.push(...b.value)
  return rankPool(pool, scoreKeywords, input.aspect, needS, topic)
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
