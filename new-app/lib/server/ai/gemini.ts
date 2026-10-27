import 'server-only'

import { recordAiUsage } from '@/lib/server/clips/ai-usage'
import {
  discoverVisionFlashLiteModel,
  geminiGenerateJson,
  geminiVisionTokenCostMicros,
  type GeminiContentPart,
} from '@/lib/server/ai/gemini-flash-lite'

export { discoverVisionFlashLiteModel } from '@/lib/server/ai/gemini-flash-lite'

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

  const schema = {
    type: 'object',
    properties: {
      bestFrameIndexes: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 2 },
      titleText: { type: 'string' },
      prompts: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    },
    required: ['bestFrameIndexes', 'titleText', 'prompts'],
  }

  const parts: GeminiContentPart[] = []
  for (const f of input.frames) {
    parts.push({
      inlineData: { mimeType: 'image/jpeg', data: f.jpeg.toString('base64') },
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

  const { text, promptTokens, outputTokens } = await geminiGenerateJson({
    model,
    parts,
    responseSchema: schema,
    temperature: 0.4,
    timeoutMs: 60_000,
  })
  const plan = JSON.parse(text) as ThumbnailPlan
  plan.titleText = String(plan.titleText || input.titleOverride || input.clipTitle).slice(0, 80)
  plan.prompts = (plan.prompts || []).slice(0, 3).map((p) => String(p))
  plan.bestFrameIndexes = (plan.bestFrameIndexes || [0]).slice(0, 2).map((n) => Math.max(0, Math.floor(n)))

  const usage: GeminiUsage = {
    provider: 'gemini',
    model,
    units: promptTokens + outputTokens,
    unitType: 'tokens',
    costUsdMicros: geminiVisionTokenCostMicros(promptTokens, outputTokens),
  }

  await recordAiUsage({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    clipId: input.clipId,
    usage,
  })

  return { plan, usage, model }
}
