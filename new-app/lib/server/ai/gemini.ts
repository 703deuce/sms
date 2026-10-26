import 'server-only'

import { recordAiUsage } from '@/lib/server/clips/ai-usage'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type GeminiUsage = {
  provider: 'gemini'
  model: string
  units: number
  unitType: 'tokens'
  costUsdMicros: number
}

export type ThumbnailPlan = {
  bestFrameIndexes: number[]
  titleText: string
  prompts: string[]
}

function geminiKey(): string {
  const key =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GEMINI_API_KEY?.trim() || ''
  if (!key) throw new Error('GEMINI_API_KEY is not configured')
  return key
}

export async function discoverVisionFlashLiteModel(): Promise<string> {
  const configured = process.env.VISION_MODEL?.trim()
  if (configured) return configured

  const key = geminiKey()
  const res = await fetch(`${GEMINI_BASE}/models?key=${encodeURIComponent(key)}`)
  if (!res.ok) throw new Error(`Gemini models list failed (${res.status})`)
  const body = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] }
  const models = body.models || []
  const candidates = models
    .filter((m) => {
      const name = String(m.name || '')
      return (
        /gemini-.*flash-lite/i.test(name) &&
        (m.supportedGenerationMethods || []).includes('generateContent')
      )
    })
    .map((m) => String(m.name).replace(/^models\//, ''))
    .sort()
  if (!candidates.length) throw new Error('No gemini flash-lite model with generateContent found')
  return candidates[candidates.length - 1]
}

function tokenCostMicros(promptTokens: number, outputTokens: number): number {
  const inMicros = (promptTokens / 1_000_000) * 0.25 * 1_000_000
  const outMicros = (outputTokens / 1_000_000) * 1.5 * 1_000_000
  return Math.round(inMicros + outMicros)
}

export async function planThumbnailFromFrames(input: {
  workspaceId: string
  clipId: string
  projectId?: string
  frames: { index: number; jpeg: Buffer }[]
  transcriptExcerpt: string
  clipTitle: string
  titleOverride?: string
}): Promise<{ plan: ThumbnailPlan; usage: GeminiUsage; model: string }> {
  const model = await discoverVisionFlashLiteModel()
  const key = geminiKey()

  const schema = {
    type: 'object',
    properties: {
      bestFrameIndexes: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 2 },
      titleText: { type: 'string' },
      prompts: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    },
    required: ['bestFrameIndexes', 'titleText', 'prompts'],
  }

  const parts: { inline_data?: { mime_type: string; data: string }; text?: string }[] = []
  for (const f of input.frames) {
    parts.push({
      inline_data: { mime_type: 'image/jpeg', data: f.jpeg.toString('base64') },
    })
    parts.push({ text: `Frame index ${f.index}` })
  }
  parts.push({
    text: `Clip title: ${input.clipTitle}
Transcript excerpt: ${input.transcriptExcerpt.slice(0, 2000)}
${input.titleOverride ? `Preferred title text: ${input.titleOverride}` : ''}

Pick the best 1-2 frames (by index) for a YouTube thumbnail: clear face, strong expression, no motion blur.
Write titleText (max 5 words) and exactly 3 Nano Banana image prompts.
Rules: bold YouTube-style thumbnail; keep the person's likeness from the reference frame; never name or depict a real named person; big readable text in the prompt using the title.`,
  })

  const res = await fetch(
    `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.4,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gemini generateContent failed (${res.status}): ${t.slice(0, 300)}`)
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty content')
  const plan = JSON.parse(text) as ThumbnailPlan
  plan.titleText = String(plan.titleText || input.titleOverride || input.clipTitle).slice(0, 80)
  plan.prompts = (plan.prompts || []).slice(0, 3).map((p) => String(p))
  plan.bestFrameIndexes = (plan.bestFrameIndexes || [0]).slice(0, 2).map((n) => Math.max(0, Math.floor(n)))

  const promptTokens = Number(json.usageMetadata?.promptTokenCount || 0)
  const outputTokens = Number(json.usageMetadata?.candidatesTokenCount || 0)
  const usage: GeminiUsage = {
    provider: 'gemini',
    model,
    units: promptTokens + outputTokens,
    unitType: 'tokens',
    costUsdMicros: tokenCostMicros(promptTokens, outputTokens),
  }

  await recordAiUsage({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    clipId: input.clipId,
    usage,
  })

  return { plan, usage, model }
}
