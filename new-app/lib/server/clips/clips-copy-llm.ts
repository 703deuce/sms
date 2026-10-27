import 'server-only'

import { discoverVisionFlashLiteModel, geminiGenerateJson, geminiVisionTokenCostMicros } from '@/lib/server/ai/gemini-flash-lite'
import { getClipsLlmModelId } from '@/lib/server/ai/clips-llm'
import { gpt6ChatCompletionExtras, isGpt6FamilyModel } from '@/lib/server/ai/gpt-6-luna-chat'
import { recordAiUsage } from '@/lib/server/clips/ai-usage'
import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import { EXPORT_PLATFORM_PRESETS } from '@/lib/clips/export-platform-presets'
import { clampHashtagsForPlatform } from '@/lib/clips/post-copy-hashtags'

export type PlatformPostCopy = {
  title: string
  description: string
  hashtags: string[]
}

export type ClipPostCopyBundle = {
  hookText: string
  platforms: Record<ExportPlatformId, PlatformPostCopy>
  provider: 'openai' | 'gemini'
  model: string
  costUsdMicros: number
  promptTokens: number
  completionTokens: number
}

const LUNA_INPUT_MICROS_PER_TOKEN = 100_000 // $0.10 / 1M
const LUNA_OUTPUT_MICROS_PER_TOKEN = 500_000 // $0.50 / 1M

function lunaTokenCostMicros(prompt: number, completion: number): number {
  return Math.round(prompt * LUNA_INPUT_MICROS_PER_TOKEN + completion * LUNA_OUTPUT_MICROS_PER_TOKEN)
}

type LlmJson = {
  hookText?: string
  tiktok?: PlatformPostCopy
  youtube_shorts?: PlatformPostCopy
  instagram_reels?: PlatformPostCopy
}

async function openAiClipsJson(system: string, user: string): Promise<{ data: LlmJson; model: string; promptTokens: number; completionTokens: number }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const model = getClipsLlmModelId()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...gpt6ChatCompletionExtras(model),
    }),
    signal: AbortSignal.timeout(90_000),
  })
  const errText = res.ok ? '' : await res.text()
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 240)}`)
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty content')
  return {
    data: JSON.parse(content) as LlmJson,
    model,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  }
}

const POST_COPY_SCHEMA = {
  type: 'object',
  properties: {
    hookText: { type: 'string' },
    tiktok: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
    youtube_shorts: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
    instagram_reels: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  required: ['hookText', 'tiktok', 'youtube_shorts', 'instagram_reels'],
}

async function geminiClipsJson(system: string, user: string): Promise<{ data: LlmJson; model: string; promptTokens: number; completionTokens: number }> {
  const model = await discoverVisionFlashLiteModel()
  const { text, promptTokens, outputTokens } = await geminiGenerateJson({
    model,
    parts: [{ text: `${system}\n\n${user}` }],
    responseSchema: POST_COPY_SCHEMA,
    temperature: 0.35,
    timeoutMs: 90_000,
  })
  return {
    data: JSON.parse(text) as LlmJson,
    model,
    promptTokens,
    completionTokens: outputTokens,
  }
}

function normalizePlatformCopy(
  raw: PlatformPostCopy | undefined,
  fallbackTitle: string,
  platform: ExportPlatformId,
): PlatformPostCopy {
  const title = (raw?.title || fallbackTitle || 'Clip').trim().slice(0, 100)
  const description = (raw?.description || '').trim().slice(0, 2200)
  const hashtags = Array.isArray(raw?.hashtags)
    ? clampHashtagsForPlatform(
        platform,
        raw!.hashtags.map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean),
      )
    : []
  return { title, description, hashtags }
}

export async function generateClipPostCopy(input: {
  workspaceId: string
  clipId: string
  projectId: string
  title: string
  hook?: string
  why?: string
  transcript: string
  durationSec: number
}): Promise<ClipPostCopyBundle> {
  const platformLines = (['tiktok', 'youtube_shorts', 'instagram_reels'] as ExportPlatformId[])
    .map((id) => {
      const p = EXPORT_PLATFORM_PRESETS[id]
      return `${id}: max ${p.maxDurationSec}s vertical short; ${p.label}`
    })
    .join('\n')

  const system = `You write post-ready social copy for short vertical clips. Return strict JSON:
{
  "hookText": "≤12 words scroll-stopping hook for on-video title overlay",
  "tiktok": { "title": "", "description": "", "hashtags": ["tag1"] },
  "youtube_shorts": { "title": "", "description": "", "hashtags": [] },
  "instagram_reels": { "title": "", "description": "", "hashtags": [] }
}
No markdown. Hashtags without # prefix. Limits: Instagram Reels max 5 tags; TikTok 3–5 tags; YouTube Shorts max 3 tags (shown above title). Match each platform tone. Clip is ${Math.round(input.durationSec)}s.`
  const user = `Clip title: ${input.title}
Hook idea: ${input.hook || '(none)'}
Why it works: ${input.why || '(none)'}
Platforms:
${platformLines}

Transcript:
${input.transcript.slice(0, 24_000)}`

  let provider: 'openai' | 'gemini' = 'openai'
  let model = getClipsLlmModelId()
  let promptTokens = 0
  let completionTokens = 0
  let data: LlmJson

  try {
    const oa = await openAiClipsJson(system, user)
    data = oa.data
    model = oa.model
    promptTokens = oa.promptTokens
    completionTokens = oa.completionTokens
    if (!isGpt6FamilyModel(model)) {
      provider = 'openai'
    }
  } catch (primaryErr) {
    console.warn('[clipper:post-copy] luna failed, gemini fallback', {
      clipId: input.clipId,
      error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
    })
    const gm = await geminiClipsJson(system, user)
    data = gm.data
    model = gm.model
    provider = 'gemini'
    promptTokens = gm.promptTokens
    completionTokens = gm.completionTokens
  }

  const costUsdMicros =
    provider === 'gemini'
      ? geminiVisionTokenCostMicros(promptTokens, completionTokens)
      : lunaTokenCostMicros(promptTokens, completionTokens)

  console.info('[clipper:post-copy] cost', {
    clipId: input.clipId,
    provider,
    model,
    promptTokens,
    completionTokens,
    costUsdMicros,
  })

  if (costUsdMicros > 0) {
    await recordAiUsage({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      clipId: input.clipId,
      usage: {
        provider,
        model,
        units: promptTokens + completionTokens,
        unitType: 'tokens',
        costUsdMicros,
      },
    })
  }

  const fallbackTitle = input.title
  return {
    hookText: (data.hookText || input.hook || input.title).trim().slice(0, 120),
    platforms: {
      tiktok: normalizePlatformCopy(data.tiktok, fallbackTitle, 'tiktok'),
      youtube_shorts: normalizePlatformCopy(data.youtube_shorts, fallbackTitle, 'youtube_shorts'),
      instagram_reels: normalizePlatformCopy(data.instagram_reels, fallbackTitle, 'instagram_reels'),
    },
    provider,
    model,
    costUsdMicros,
    promptTokens,
    completionTokens,
  }
}
