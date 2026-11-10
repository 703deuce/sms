import 'server-only'

import type { AdProductInput, AdScript, AdPlan, AdMode, AdScene } from '@/lib/ad-studio/types'
import { AD_STUDIO_COSTS } from '@/lib/ad-studio/costs'
import { discoverVisionFlashLiteModel, geminiGenerateJson, geminiVisionConfigured } from '@/lib/server/ai/gemini-flash-lite'
import { getStudioModel } from '@/lib/studio/models'
import { findStockForScene } from './stock'
import type { PixabayHitPublic } from '@/lib/server/ai/pixabay'

type Hint = { role: AdScene['role']; stockQuery: string; requiresProductMotion: boolean }
type HintResponse = { scenes: Hint[] }
const HINT_SCHEMA = {
  type: 'object',
  properties: { scenes: { type: 'array', items: { type: 'object', properties: {
    role: { type: 'string', enum: ['hook','problem','solution','cta','other'] },
    stockQuery: { type: 'string' }, requiresProductMotion: { type: 'boolean' },
  }, required: ['role', 'stockQuery', 'requiresProductMotion'] } } },
  required: ['scenes'],
}
const ROLES: Record<15 | 30, AdScene['role'][]> = {
  15: ['hook','problem','solution','cta'],
  30: ['hook','problem','solution','solution','other','cta'],
}
const DURATIONS: Record<15 | 30, number[]> = {
  15: [4,4,4,3],
  30: [5,5,5,5,5,5],
}

function groundedQuery(input: AdProductInput, role: AdScene['role']): string {
  const point = input.sellingPoints[role === 'solution' ? 0 : Math.min(1, input.sellingPoints.length - 1)] || input.name
  return (input.name + ' ' + point).replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
}

async function chooseHints(input: AdProductInput, roles: AdScene['role'][]): Promise<Hint[]> {
  console.info('[ad-studio:planner] hints_begin', { count: roles.length })
  if (!geminiVisionConfigured()) {
    console.warn('[ad-studio:planner] model_unconfigured_grounded_hints')
    return roles.map((role) => ({ role, stockQuery: groundedQuery(input, role), requiresProductMotion: role === 'solution' && input.imageAssetIds.length > 0 }))
  }
  try {
    const model = await discoverVisionFlashLiteModel()
    const response = await geminiGenerateJson({
      model,
      parts: [{ text: [
        'You plan REAL stock visuals for a product ad. Give one literal 2-8 word Pixabay video search per scene.',
        'Do not invent attributes of the product or anything that resembles its branded packaging.',
        'Mark requiresProductMotion true only for solution shots actually showing the supplied product moving.',
        'Do not invent new product claims. Return one suggestion per scene, in order.',
        JSON.stringify({ name: input.name, sellingPoints: input.sellingPoints, audience: input.audience, roles }),
      ].join('\n') }],
      responseSchema: HINT_SCHEMA, temperature: 0.2, timeoutMs: 45_000,
    })
    const parsed = JSON.parse(response.text) as HintResponse
    console.info('[ad-studio:planner] hints_model_complete', { model, inputTokens: response.promptTokens, outputTokens: response.outputTokens, suggestions: parsed.scenes?.length ?? 0 })
    return roles.map((role, i) => ({
      role, stockQuery: typeof parsed.scenes?.[i]?.stockQuery === 'string'
        ? parsed.scenes[i]!.stockQuery.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').slice(0, 90)
        : groundedQuery(input, role),
      requiresProductMotion: Boolean(role === 'solution' && input.imageAssetIds.length && parsed.scenes?.[i]?.requiresProductMotion),
    }))
  } catch (err) {
    console.warn('[ad-studio:planner] hints_model_fallback', { errorType: err instanceof Error ? err.name : 'unknown' })
    return roles.map((role) => ({ role, stockQuery: groundedQuery(input, role), requiresProductMotion: role === 'solution' && input.imageAssetIds.length > 0 }))
  }
}

/** One image remains a held source: no imaginary product visuals are permitted in the prompt. */
function generatedPrompt(input: AdProductInput, role: AdScene['role'], copy: string): string {
  const reference = input.imageAssetIds.length
    ? 'Use the exact provided product image as the reference. Preserve logo, text, packaging, proportions and colors; never replace or redraw them.'
    : 'This is generic supporting footage. Do not depict a branded product or invent packaging, logos or features.'
  return [
    'Short realistic commercial video shot. Keep one coherent visual subject; no fictional claims.',
    reference, 'Product name: ' + input.name, 'Beat: ' + role,
    'Only approved copy: ' + copy.slice(0, 240),
    'Do not add new onscreen text or claim any additional benefit.',
  ].join('\n')
}

function chooseRegistryModel(aspect: AdProductInput['aspect']): string {
  const id = aspect === '1:1' ? 'seedance-2.0-mini' : 'veo-3.1-lite'
  const found = getStudioModel(id)
  if (!found || !found.aspects.includes(aspect) || !found.modes.includes('image_to_video'))
    throw new Error('ad_studio_supported_model_unavailable')
  return id
}

/** Single-source-of-truth v1 scene plan; B3 performs all paid model calls and stitches. */
export async function planAdScenes(input: AdProductInput, mode: AdMode, script: AdScript,
  deps: { hints?: (input: AdProductInput, roles: AdScene['role'][]) => Promise<Hint[]>; stock?: (query: string, durationSec: number, aspect: string) => Promise<PixabayHitPublic | null> } = {}): Promise<AdPlan> {
  console.info('[ad-studio:planner] plan_begin', { mode, durationSec: input.durationSec, aspect: input.aspect })
  const durations = DURATIONS[input.durationSec]
  const roles = ROLES[input.durationSec]
  const hints = mode === 'storyline'
    ? await (deps.hints ?? chooseHints)(input, roles)
    : []
  const scenes: AdScene[] = []
  let cursor = 0
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i]!
    const seconds = durations[i]!
    const hint = hints[i] || { role, stockQuery: groundedQuery(input, role), requiresProductMotion: false }
    const onScreenText = role === 'hook' ? script.hook : role === 'problem' ? script.problem : role === 'solution' ? script.solution : role === 'cta' ? script.cta : ''
    const isProductShot = mode === 'image_to_ad' || (hint.requiresProductMotion && input.imageAssetIds.length > 0)
    console.info('[ad-studio:planner] scene_select_begin', { sceneIndex: i, role, requiredProductShot: isProductShot })
    const hit = !isProductShot && mode === 'storyline'
      ? await (deps.stock ?? findStockForScene)(hint.stockQuery, seconds, input.aspect)
      : null
    const startMs = cursor
    const endMs = startMs + seconds * 1000
    cursor = endMs
    if (hit) {
      const sourceInMs = 0
      scenes.push({ index: i, role, durationSec: seconds, source: 'stock',
        reason: 'Real stock illustrates the supporting scene without changing the product appearance.',
        providerId: hit.providerId, stockQuery: hint.stockQuery,
        sourceInMs, sourceOutMs: sourceInMs + seconds * 1000,
        startMs, endMs, onScreenText: onScreenText.slice(0, 150) })
    } else {
      const modelId = chooseRegistryModel(input.aspect)
      const referenceAssetId = input.imageAssetIds[0]
      scenes.push({ index: i, role, durationSec: seconds, source: 'generated',
        reason: isProductShot ? 'Short motion shot grounded in an existing product image.' : 'No suitable stock found; use a short generic supporting shot without inventing product details.',
        modelId, referenceAssetId, prompt: generatedPrompt(input, role, onScreenText), startMs, endMs, onScreenText: onScreenText.slice(0, 150) })
    }
    const scene = scenes[scenes.length - 1]!
    console.info('[ad-studio:planner] scene_selected', { sceneIndex: i, source: scene.source, reason: scene.reason, modelId: scene.modelId, providerId: scene.providerId, sourceInMs: scene.sourceInMs, sourceOutMs: scene.sourceOutMs })
  }
  if (cursor !== input.durationSec * 1000) throw new Error('ad_studio_plan_duration_mismatch')
  const key = (mode + '_' + input.durationSec) as keyof typeof AD_STUDIO_COSTS
  const plan: AdPlan = {
    script, imagery: { imageJobIds: [], preservedSourceAssetIds: [...input.imageAssetIds] },
    scenes, creditEstimate: AD_STUDIO_COSTS[key],
    modelStrategy: 'Use real stock wherever appropriate; generate short reference-preserving shots only when needed. Model selection is internal. All generation waits for confirmation.',
  }
  console.info('[ad-studio:planner] plan_complete', { scenes: scenes.length, stock: scenes.filter((s) => s.source === 'stock').length, generated: scenes.filter((s) => s.source === 'generated').length, creditEstimateConfigured: plan.creditEstimate !== null })
  return plan
}
