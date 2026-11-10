import 'server-only'

import type { AdProductInput, AdScript } from '@/lib/ad-studio/types'
import { discoverVisionFlashLiteModel, geminiGenerateJson, geminiVisionConfigured } from '@/lib/server/ai/gemini-flash-lite'

type Angle = { primaryPointIndex: number; secondaryPointIndex: number; hookStyle: 'question' | 'direct'; ctaStyle: 'explore' | 'learn' }
const ANGLE_SCHEMA = {
  type: 'object',
  properties: {
    primaryPointIndex: { type: 'integer' },
    secondaryPointIndex: { type: 'integer' },
    hookStyle: { type: 'string', enum: ['question', 'direct'] },
    ctaStyle: { type: 'string', enum: ['explore', 'learn'] },
  },
  required: ['primaryPointIndex', 'secondaryPointIndex', 'hookStyle', 'ctaStyle'],
}
const DEFAULT_ANGLE: Angle = { primaryPointIndex: 0, secondaryPointIndex: 1, hookStyle: 'question', ctaStyle: 'explore' }

async function chooseAngle(input: AdProductInput): Promise<Angle> {
  console.info('[ad-studio:storyline] angle_begin', { durationSec: input.durationSec, points: input.sellingPoints.length })
  if (!geminiVisionConfigured()) {
    console.warn('[ad-studio:storyline] model_unconfigured_using_grounded_angle')
    return DEFAULT_ANGLE
  }
  try {
    const model = await discoverVisionFlashLiteModel()
    const response = await geminiGenerateJson({
      model,
      parts: [{ text: [
        'You are an advertising storyline agent. Choose a narrative ordering, not new facts.',
        'Only the listed selling points are factual claims. Do not add product features, statistics or promises.',
        'Return indices (0-based) and one of the allowed hook and CTA styles. No other text.',
        JSON.stringify({ name: input.name, sellingPoints: input.sellingPoints, audience: input.audience, durationSec: input.durationSec }),
      ].join('\n') }],
      responseSchema: ANGLE_SCHEMA, temperature: 0.2, timeoutMs: 45_000,
    })
    const result = JSON.parse(response.text) as Partial<Angle>
    console.info('[ad-studio:storyline] angle_model_complete', { model, inputTokens: response.promptTokens, outputTokens: response.outputTokens })
    return {
      primaryPointIndex: Number.isInteger(result.primaryPointIndex) ? Number(result.primaryPointIndex) : 0,
      secondaryPointIndex: Number.isInteger(result.secondaryPointIndex) ? Number(result.secondaryPointIndex) : 1,
      hookStyle: result.hookStyle === 'direct' ? 'direct' : 'question',
      ctaStyle: result.ctaStyle === 'learn' ? 'learn' : 'explore',
    }
  } catch (err) {
    console.warn('[ad-studio:storyline] angle_model_failed_grounded_fallback', { type: err instanceof Error ? err.name : 'unknown' })
    return DEFAULT_ANGLE
  }
}

/** Model chooses the angle; literal user claims are the only statements inserted into the script. */
export async function writeAdStoryline(input: AdProductInput, choose: (input: AdProductInput) => Promise<Angle> = chooseAngle): Promise<AdScript> {
  console.info('[ad-studio:storyline] script_begin', { durationSec: input.durationSec })
  const angle = await choose(input)
  const points = input.sellingPoints
  const primary = points[Math.max(0, Math.min(points.length - 1, angle.primaryPointIndex))] || points[0]!
  const secondary = points[Math.max(0, Math.min(points.length - 1, angle.secondaryPointIndex))] || primary
  const hook = angle.hookStyle === 'question' ? 'Looking for ' + input.name + '?' : 'Introducing ' + input.name + '.'
  const problem = 'What matters most to you?'
  const solution = [primary, ...(secondary !== primary && input.durationSec === 30 ? [secondary] : [])].join('. ').replace(/\.\./g, '.')
  const cta = angle.ctaStyle === 'learn' ? 'Learn more about ' + input.name + '.' : 'Explore ' + input.name + '.'
  const voiceover = [hook, problem, solution, cta].join(' ')
  const onScreenText = [hook, primary, ...(secondary !== primary ? [secondary] : []), cta].slice(0, 5)
  console.info('[ad-studio:storyline] script_complete', { voicedWords: voiceover.split(/\s+/).length, textBeats: onScreenText.length })
  return { hook, problem, solution, cta, voiceover, onScreenText }
}
