import 'server-only'
import { createHash } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { recordAiUsage } from '@/lib/server/clips/ai-usage'
import {
  discoverVisionFlashLiteModel,
  geminiGenerateJson,
  geminiVisionTokenCostMicros,
  type GeminiContentPart,
} from '@/lib/server/ai/gemini-flash-lite'
import {
  lunaTokenCostMicros,
  openAiStockVisionModelId,
  openAiStockVisionReasoningEffort,
  resolveStockVisionBackend,
  type StockVisionBackend,
} from '@/lib/server/t2v/stock-vision-config'
import { logT2v } from '@/lib/server/t2v/log'
import type { StockCandidate } from '@/lib/server/t2v/stock-match'

const VISION_CACHE_VERSION = 'v3'
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
  model?: string
  backend?: StockVisionBackend
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

async function thumbInlinePart(url: string): Promise<GeminiContentPart | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32 || buf.length > 2_000_000) return null
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    return { inlineData: { mimeType: mime || 'image/jpeg', data: buf.toString('base64') } }
  } catch {
    return null
  }
}

function visionCacheKey(scene: StockVisionSceneInput, backend: StockVisionBackend, model: string): string {
  const ids = scene.candidates.map((c) => `${c.provider}:${c.providerId}`).join('|')
  const raw = `${VISION_CACHE_VERSION}|${backend}|${model}|${scene.query}|${ids}`
  return createHash('sha1').update(raw).digest('hex')
}

async function readVisionCache(
  scene: StockVisionSceneInput,
  backend: StockVisionBackend,
  model: string,
): Promise<StockVisionSceneResult | null> {
  const prisma = getPrisma()
  const q = `t2v|stock-vision|${visionCacheKey(scene, backend, model)}`
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

async function writeVisionCache(
  scene: StockVisionSceneInput,
  backend: StockVisionBackend,
  model: string,
  pickIndex: number | 'none',
  reason: string,
) {
  const prisma = getPrisma()
  const q = `t2v|stock-vision|${visionCacheKey(scene, backend, model)}`
  await prisma.brollSearchCache.upsert({
    where: { q },
    create: { q, json: { pickIndex, reason } },
    update: { json: { pickIndex, reason }, createdAt: new Date() },
  })
}

function candidateIds(candidates: StockCandidate[]): string[] {
  return candidates.map((c) => `${c.provider}:${c.providerId}`)
}

function sceneBriefs(scenes: StockVisionSceneInput[]) {
  return scenes.map((s) => ({
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
}

function parseVisionJson(text: string): Map<string, { pickIndex: number | 'none'; reason: string }> {
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
  return out
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sceneId: { type: 'string' },
          pick: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['sceneId', 'pick', 'reason'],
      },
    },
  },
  required: ['scenes'],
}

async function callOpenAiLunaVisionBatch(
  scenes: StockVisionSceneInput[],
  model: string,
): Promise<{
  results: Map<string, { pickIndex: number | 'none'; reason: string }>
  promptTokens: number
  completionTokens: number
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY missing')

  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail: 'low' } }> = [
    {
      type: 'text',
      text:
        'You pick the best stock VIDEO thumbnail per scene for a short video. ' +
        'Return JSON: {"scenes":[{"sceneId":string,"pick":number,"reason":string}]}. ' +
        'pick is candidate index 0..n-1, or -1 if NONE match narration/visual/topic. ' +
        'Scene briefs:\n' +
        JSON.stringify(sceneBriefs(scenes)),
    },
  ]

  for (const s of scenes) {
    content.push({ type: 'text', text: `Scene ${s.sceneIndex + 1} (${s.sceneId}) thumbnails:` })
    for (const c of s.candidates) {
      const url = candidateThumb(c)
      if (!url) continue
      const img = await thumbInlinePart(url)
      const inline = img && 'inlineData' in img ? img.inlineData : undefined
      if (!inline?.data) continue
      const dataUrl = `data:${inline.mimeType};base64,${inline.data}`
      content.push({ type: 'image_url', image_url: { url: dataUrl, detail: 'low' } })
    }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: 900,
      reasoning_effort: openAiStockVisionReasoningEffort(),
      response_format: { type: 'json_object' },
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

  return {
    results: parseVisionJson(text),
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  }
}

async function callGeminiVisionBatch(
  scenes: StockVisionSceneInput[],
  model: string,
): Promise<{
  results: Map<string, { pickIndex: number | 'none'; reason: string }>
  promptTokens: number
  completionTokens: number
}> {
  const parts: GeminiContentPart[] = [
    {
      text:
        'You pick the best stock VIDEO thumbnail per scene for a short video. ' +
        'Each scene lists candidate stills in order (index 0..n-1). ' +
        'Return JSON matching the schema. Use pick=-1 if NONE match narration/visual/topic (off-topic). ' +
        'Prefer literal on-camera subject match. Scene briefs:\n' +
        JSON.stringify(sceneBriefs(scenes)),
    },
  ]

  for (const s of scenes) {
    parts.push({ text: `Scene ${s.sceneIndex + 1} (${s.sceneId}) thumbnails:` })
    for (const c of s.candidates) {
      const url = candidateThumb(c)
      if (!url) continue
      const img = await thumbInlinePart(url)
      if (img) parts.push(img)
    }
  }

  const { text, promptTokens, outputTokens } = await geminiGenerateJson({
    model,
    parts,
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.3,
    timeoutMs: TIMEOUT_MS,
  })

  return { results: parseVisionJson(text), promptTokens, completionTokens: outputTokens }
}

async function resolveVisionModel(backend: StockVisionBackend): Promise<string> {
  if (backend === 'openai-luna') return openAiStockVisionModelId()
  return discoverVisionFlashLiteModel()
}

async function runVisionBatch(
  chunk: StockVisionSceneInput[],
  backend: StockVisionBackend,
  model: string,
) {
  if (backend === 'openai-luna') {
    const r = await callOpenAiLunaVisionBatch(chunk, model)
    return { ...r, costUsdMicros: lunaTokenCostMicros(r.promptTokens, r.completionTokens) }
  }
  const r = await callGeminiVisionBatch(chunk, model)
  return { ...r, costUsdMicros: geminiVisionTokenCostMicros(r.promptTokens, r.completionTokens) }
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
  let modelUsed: string | undefined
  let backendUsed: StockVisionBackend | undefined

  const needApi: StockVisionSceneInput[] = []
  const backend = resolveStockVisionBackend()

  if (backend) {
    try {
      modelUsed = await resolveVisionModel(backend)
      backendUsed = backend
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logT2v('stock-vision', 'model resolve failed, score fallback', {
        backend,
        error: message,
        stockVisionModel: process.env.STOCK_VISION_MODEL ?? '',
      })
    }
  }

  for (const scene of input.scenes) {
    const cached =
      backendUsed && modelUsed ? await readVisionCache(scene, backendUsed, modelUsed) : null
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

  if (needApi.length > 0 && (!backend || !modelUsed)) {
    logT2v('stock-vision', 'model unavailable, score fallback', {
      backend: backend ?? 'none',
      stockVisionModel: process.env.STOCK_VISION_MODEL ?? '',
    })
    for (const scene of needApi) {
      results.push({
        sceneId: scene.sceneId,
        pickIndex: 0,
        reason: 'vision_unconfigured',
        fromCache: false,
        scoreFallback: true,
      })
    }
    needApi.length = 0
  }

  for (let i = 0; i < needApi.length; i += MAX_SCENES_PER_REQUEST) {
    const chunk = needApi.slice(i, i + MAX_SCENES_PER_REQUEST)
    const chunkStart = Date.now()
    try {
      const {
        results: apiMap,
        promptTokens: pt,
        completionTokens: ct,
        costUsdMicros: chunkCost,
      } = await runVisionBatch(chunk, backendUsed!, modelUsed!)
      promptTokens += pt
      completionTokens += ct
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
          await writeVisionCache(scene, backendUsed!, modelUsed!, pickIndex, reason)
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
          model: modelUsed,
          backend: backendUsed,
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
        model: modelUsed,
        backend: backendUsed,
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
          model: modelUsed,
        })
      }
    }
  }

  if (costUsdMicros > 0 && input.workspaceId && modelUsed && backendUsed) {
    await recordAiUsage({
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      usage: {
        provider: backendUsed === 'openai-luna' ? 'openai' : 'gemini',
        model: modelUsed,
        units: promptTokens + completionTokens,
        unitType: 'tokens',
        costUsdMicros,
      },
    })
    logT2v('cost', 'stock-vision', {
      projectId: input.projectId,
      backend: backendUsed,
      model: modelUsed,
      sceneCount: input.scenes.length,
      promptTokens,
      completionTokens,
      costUsdMicros,
    })
  }

  const metrics: StockVisionBatchMetrics = {
    latencyMs: Date.now() - started,
    costUsdMicros,
    promptTokens,
    completionTokens,
    sceneCount: input.scenes.length,
    model: modelUsed,
    backend: backendUsed,
  }

  const costUsd =
    metrics.costUsdMicros > 0 ? Math.round((metrics.costUsdMicros / 1_000_000) * 1_000_000) / 1_000_000 : 0
  logT2v('stock-vision', 'batch complete', {
    sceneCount: metrics.sceneCount,
    latencyMs: metrics.latencyMs,
    costUsdMicros: metrics.costUsdMicros,
    costUsd,
    costUsdPerScene:
      metrics.sceneCount > 0 && metrics.costUsdMicros > 0
        ? Math.round((metrics.costUsdMicros / metrics.sceneCount) * 100) / 100
        : 0,
    promptTokens: metrics.promptTokens,
    completionTokens: metrics.completionTokens,
    model: metrics.model,
    backend: metrics.backend,
    reasoningEffort: metrics.backend === 'openai-luna' ? openAiStockVisionReasoningEffort() : undefined,
    stockVisionModel: process.env.STOCK_VISION_MODEL ?? '(default)',
  })

  return { results, metrics }
}
