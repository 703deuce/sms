import 'server-only'
import { createHash } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { recordAiUsage } from '@/lib/server/clips/ai-usage'
import { logT2v } from '@/lib/server/t2v/log'
import type { StockCandidate } from '@/lib/server/t2v/stock-match'

const VISION_MODEL = process.env.T2V_STOCK_VISION_MODEL?.trim() || 'gpt-4o-mini'
const VISION_CACHE_VERSION = 'v1'
const TIMEOUT_MS = 10_000
const MAX_SCENES_PER_REQUEST = 8

const ALLOWED_THUMB_HOSTS = [
  'cdn.pixabay.com',
  'pixabay.com',
  'images.pexels.com',
  'videos.pexels.com',
  'pexels.com',
]

export type StockVisionSceneInput = {
  sceneIndex: number
  sceneId: string
  videoTopic: string
  visualQuery: string
  narration: string
  query: string
  candidates: StockCandidate[]
}

export type StockVisionSceneResult = {
  sceneId: string
  pickIndex: number | 'none'
  reason: string
  fromCache: boolean
  scoreFallback: boolean
}

export type StockVisionBatchMetrics = {
  latencyMs: number
  costUsdMicros: number
  promptTokens: number
  completionTokens: number
  sceneCount: number
}

function thumbAllowed(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase()
    return ALLOWED_THUMB_HOSTS.some((s) => h === s || h.endsWith(`.${s}`))
  } catch {
    return false
  }
}

function candidateThumb(c: StockCandidate): string | null {
  const url = (c.thumbUrl || c.previewUrl || '').trim()
  if (!url.startsWith('https://')) return null
  if (!thumbAllowed(url)) return null
  return url
}

function visionCacheKey(scene: StockVisionSceneInput): string {
  const ids = scene.candidates.map((c) => `${c.provider}:${c.providerId}`).join('|')
  const raw = `${VISION_CACHE_VERSION}|${scene.query}|${ids}`
  return createHash('sha1').update(raw).digest('hex')
}

function tokenCostMicros(promptTokens: number, completionTokens: number): number {
  // gpt-4o-mini list pricing (per 1M tokens): input $0.15, output $0.60 → USD micros
  return Math.round(promptTokens * 0.15 + completionTokens * 0.6)
}

async function readVisionCache(scene: StockVisionSceneInput): Promise<StockVisionSceneResult | null> {
  const prisma = getPrisma()
  const q = `t2v|stock-vision|${visionCacheKey(scene)}`
  const row = await prisma.brollSearchCache.findUnique({ where: { q } })
  if (!row) return null
  const data = row.json as { pickIndex: number | 'none'; reason: string }
  if (data.pickIndex === 'none' || (typeof data.pickIndex === 'number' && data.pickIndex >= 0)) {
    return {
      sceneId: scene.sceneId,
      pickIndex: data.pickIndex,
      reason: data.reason,
      fromCache: true,
      scoreFallback: false,
    }
  }
  return null
}

async function writeVisionCache(scene: StockVisionSceneInput, pickIndex: number | 'none', reason: string) {
  const prisma = getPrisma()
  const q = `t2v|stock-vision|${visionCacheKey(scene)}`
  await prisma.brollSearchCache.upsert({
    where: { q },
    create: { q, json: { pickIndex, reason } },
    update: { json: { pickIndex, reason }, createdAt: new Date() },
  })
}

function candidateIds(candidates: StockCandidate[]): string[] {
  return candidates.map((c) => `${c.provider}:${c.providerId}`)
}

async function callOpenAiVisionBatch(
  scenes: StockVisionSceneInput[],
): Promise<{
  results: Map<string, { pickIndex: number | 'none'; reason: string }>
  promptTokens: number
  completionTokens: number
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY missing')

  const sceneBriefs = scenes.map((s) => ({
    sceneId: s.sceneId,
    sceneIndex: s.sceneIndex,
    videoTopic: s.videoTopic.slice(0, 200),
    visualQuery: s.visualQuery.slice(0, 200),
    narration: s.narration.slice(0, 400),
    searchQuery: s.query.slice(0, 120),
    candidates: s.candidates.map((c, i) => ({
      index: i,
      id: `${c.provider}:${c.providerId}`,
      tags: c.tags.slice(0, 12),
    })),
  }))

  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail: 'low' } }> = [
    {
      type: 'text',
      text:
        'You pick the best stock VIDEO thumbnail per scene for a short video. ' +
        'Each scene lists candidate stills (index 0..n-1). ' +
        'Return JSON: {"scenes":[{"sceneId":string,"pick":number,"reason":string}]} ' +
        'Use pick=-1 if NONE of the thumbnails match the narration/visual/topic (off-topic). ' +
        'Prefer literal subject match (what the camera would show). Scene briefs:\n' +
        JSON.stringify(sceneBriefs),
    },
  ]

  for (const s of scenes) {
    content.push({ type: 'text', text: `Scene ${s.sceneIndex + 1} (${s.sceneId}) thumbnails:` })
    for (const c of s.candidates) {
      const url = candidateThumb(c)
      if (url) {
        content.push({ type: 'image_url', image_url: { url, detail: 'low' } })
      }
    }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 800,
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`openai_vision_${res.status}:${t.slice(0, 120)}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const text = json.choices?.[0]?.message?.content
  if (!text) throw new Error('openai_vision_empty')

  const parsed = JSON.parse(text) as {
    scenes?: Array<{ sceneId: string; pick: number; reason?: string }>
  }
  const out = new Map<string, { pickIndex: number | 'none'; reason: string }>()
  for (const row of parsed.scenes ?? []) {
    const pick = Number(row.pick)
    const pickIndex = pick < 0 ? 'none' : pick
    out.set(row.sceneId, {
      pickIndex,
      reason: String(row.reason ?? '').slice(0, 240),
    })
  }
  return {
    results: out,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  }
}

/**
 * Batched vision pick for multiple scenes (chunks if needed). On failure, returns scoreFallback per scene.
 */
export async function batchStockVisionPick(input: {
  scenes: StockVisionSceneInput[]
  workspaceId?: string
  projectId?: string
}): Promise<{ results: StockVisionSceneResult[]; metrics: StockVisionBatchMetrics }> {
  const started = Date.now()
  const results: StockVisionSceneResult[] = []
  let promptTokens = 0
  let completionTokens = 0
  let costUsdMicros = 0

  const needApi: StockVisionSceneInput[] = []
  for (const scene of input.scenes) {
    const cached = await readVisionCache(scene)
    if (cached) {
      results.push(cached)
      logT2v('stock-vision', 'scene pick (cache)', {
        sceneIndex: scene.sceneIndex,
        sceneId: scene.sceneId,
        candidateIds: candidateIds(scene.candidates),
        pick: cached.pickIndex,
        reason: cached.reason,
        latencyMs: 0,
      })
      continue
    }
    if (scene.candidates.some((c) => candidateThumb(c))) needApi.push(scene)
    else {
      results.push({
        sceneId: scene.sceneId,
        pickIndex: 0,
        reason: 'no_thumb_urls',
        fromCache: false,
        scoreFallback: true,
      })
    }
  }

  for (let i = 0; i < needApi.length; i += MAX_SCENES_PER_REQUEST) {
    const chunk = needApi.slice(i, i + MAX_SCENES_PER_REQUEST)
    const chunkStart = Date.now()
    try {
      const { results: apiMap, promptTokens: pt, completionTokens: ct } = await callOpenAiVisionBatch(chunk)
      promptTokens += pt
      completionTokens += ct
      const chunkCost = tokenCostMicros(pt, ct)
      costUsdMicros += chunkCost

      for (const scene of chunk) {
        const row = apiMap.get(scene.sceneId)
        const reason = row?.reason ?? 'missing_in_response'
        const scoreFallback = !row
        let pickIndex: number | 'none' = 0
        if (!row) {
          pickIndex = 0
        } else if (row.pickIndex === 'none') {
          pickIndex = 'none'
        } else if (
          typeof row.pickIndex === 'number' &&
          row.pickIndex >= 0 &&
          row.pickIndex < scene.candidates.length
        ) {
          pickIndex = row.pickIndex
        } else {
          pickIndex = 0
        }
        if (row) {
          await writeVisionCache(scene, pickIndex, reason)
        }
        const latencyMs = Date.now() - chunkStart
        logT2v('stock-vision', 'scene pick', {
          sceneIndex: scene.sceneIndex,
          sceneId: scene.sceneId,
          candidateIds: candidateIds(scene.candidates),
          pick: pickIndex,
          reason,
          latencyMs,
          scoreFallback,
        })
        results.push({
          sceneId: scene.sceneId,
          pickIndex,
          reason,
          fromCache: false,
          scoreFallback,
        })
      }
    } catch (err) {
      const latencyMs = Date.now() - chunkStart
      const message = err instanceof Error ? err.message : String(err)
      logT2v('stock-vision', 'batch failed, score fallback', {
        sceneCount: chunk.length,
        latencyMs,
        error: message,
      })
      for (const scene of chunk) {
        results.push({
          sceneId: scene.sceneId,
          pickIndex: 0,
          reason: 'vision_failed',
          fromCache: false,
          scoreFallback: true,
        })
        logT2v('stock-vision', 'scene pick', {
          sceneIndex: scene.sceneIndex,
          sceneId: scene.sceneId,
          candidateIds: candidateIds(scene.candidates),
          pick: 0,
          reason: 'vision_failed',
          latencyMs,
          scoreFallback: true,
        })
      }
    }
  }

  if (costUsdMicros > 0 && input.workspaceId) {
    await recordAiUsage({
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      usage: {
        provider: 'openai',
        model: VISION_MODEL,
        units: promptTokens + completionTokens,
        unitType: 'tokens',
        costUsdMicros,
      },
    })
  }

  const metrics: StockVisionBatchMetrics = {
    latencyMs: Date.now() - started,
    costUsdMicros,
    promptTokens,
    completionTokens,
    sceneCount: input.scenes.length,
  }

  logT2v('stock-vision', 'batch complete', {
    sceneCount: metrics.sceneCount,
    latencyMs: metrics.latencyMs,
    costUsdMicros: metrics.costUsdMicros,
    promptTokens: metrics.promptTokens,
    completionTokens: metrics.completionTokens,
  })

  return { results, metrics }
}
