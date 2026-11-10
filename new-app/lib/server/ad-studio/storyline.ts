import 'server-only'
import type { AdMode, AdProductInput, AdScript } from '@/lib/ad-studio/types'
import { writeAdStoryline, type StorylineChoice } from '@/lib/ad-studio/storyline-agent'
import {
  discoverVisionFlashLiteModel, geminiGenerateJson, geminiVisionConfigured,
} from '@/lib/server/ai/gemini-flash-lite'

/**
 * Small language-agent choice step: the model can only select supplied claim
 * indices and a fixed hook style. Final ad copy is composed from actual claims,
 * never from unvalidated free-form model prose.
 */
export async function writeGroundedAdStoryline(input: AdProductInput, mode: AdMode): Promise<AdScript> {
  console.info('[ad-studio:storyline:agent] begin', { mode, claims: input.sellingPoints.length })
  if (!geminiVisionConfigured()) {
    console.info('[ad-studio:storyline:agent] no_model_configured_fallback')
    return writeAdStoryline(input, mode)
  }
  try {
    console.info('[ad-studio:storyline:agent] model_discovery_begin')
    const model = await discoverVisionFlashLiteModel()
    console.info('[ad-studio:storyline:agent] model_discovery_complete', { model })
    const prompt = [
      'Select the best narrative emphasis for a short product advertisement.',
      'Return JSON only. Never invent or infer a new claim. Your response can only select indices in the provided sellingPoints list.',
      'The final text will be assembled from user-provided claims, not freeform AI text.',
      `Product: ${input.name}`,
      `Audience: ${input.audience ?? 'unspecified'}`,
      `Brand notes: ${input.brandNotes ?? 'none'}`,
      `Mode: ${mode}; Duration: ${input.durationSec} seconds`,
      `Selling points: ${JSON.stringify(input.sellingPoints)}`,
    ].join('\n')
    const response = await geminiGenerateJson({
      model, parts: [{ text: prompt }], temperature: 0.2, timeoutMs: 20_000,
      responseSchema: {
        type: 'object',
        properties: {
          leadClaimIndex: { type: 'integer' },
          supportingClaimIndex: { type: 'integer' },
          hookStyle: { type: 'string', enum: ['meet','introducing','discover'] },
        },
        required: ['leadClaimIndex','supportingClaimIndex','hookStyle'],
      },
    })
    const choice = JSON.parse(response.text) as StorylineChoice
    console.info('[ad-studio:storyline:agent] decision_complete', {
      model, leadClaimIndex: choice.leadClaimIndex, supportingClaimIndex: choice.supportingClaimIndex,
      hookStyle: choice.hookStyle, promptTokens: response.promptTokens, outputTokens: response.outputTokens,
    })
    return writeAdStoryline(input, mode, choice)
  } catch (err) {
    console.warn('[ad-studio:storyline:agent] provider_unavailable_fallback', {
      reasonType: err instanceof Error ? err.name : typeof err,
    })
    return writeAdStoryline(input, mode)
  }
}
