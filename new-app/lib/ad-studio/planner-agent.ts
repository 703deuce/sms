import { AD_STUDIO_COSTS } from './costs'
import { adGenerationWindow } from './durations'
import { getStudioModel } from '@/lib/studio/models'
import type { AdMode, AdProductInput, AdScript, AdPlan, AdScene } from './types'
import { chooseStockHit, stockTrim, type AdStockHit } from './stock'

export type AdStockSearch = (query: string) => Promise<AdStockHit[]>

/** B2 planning only: scenes never trigger a provider task here. */
export async function planAdScenes(args: {
  runId: string; mode: AdMode; input: AdProductInput; script: AdScript; search: AdStockSearch
}): Promise<AdPlan> {
  const { runId, input, mode, script, search } = args
  console.info('[ad-studio:planner] begin', { runId, mode, seconds: input.durationSec })
  const segments = input.durationSec === 15 ? [4, 4, 4, 3] : [7, 8, 8, 7]
  const roles: AdScene['role'][] = ['hook','problem','solution','cta']
  const cards = [script.hook, script.problem, script.solution, script.cta]
  const claims = input.sellingPoints
  const productRef = input.imageAssetIds[0]
  const planned: AdScene[] = []
  let cursor = 0
  for (let i = 0; i < segments.length; i++) {
    const durationSec = segments[i]!
    const role = roles[i]!
    console.info('[ad-studio:planner] scene_begin', { runId, sceneIndex: i, role })
    // Product-specific visuals require a real product image. General background visuals favor stock.
    const productShot = mode === 'image_to_ad' || (Boolean(productRef) && (role === 'solution' || role === 'cta'))
    const query = role === 'problem'
      ? (input.audience || input.name)
      : (claims[0] || input.name)
    let hits: AdStockHit[] = []
    if (!productShot) {
      console.info('[ad-studio:planner] stock_search_begin', { runId, sceneIndex: i })
      try {
        hits = await search(query)
        console.info('[ad-studio:planner] stock_search_complete', { runId, sceneIndex: i, hits: hits.length })
      } catch {
        console.warn('[ad-studio:planner] stock_search_unavailable', { runId, sceneIndex: i })
      }
    }
    const stock = !productShot ? chooseStockHit(hits, durationSec, input.aspect) : null
    const useStock = Boolean(stock)
    // Only 2–5 second generated clips. Longer card windows are stills/stock, never unsupported 8s images.
    const model = getStudioModel(input.aspect === '1:1' ? 'seedance-2.0-mini' : 'veo-3.1-lite')
    if (!model || !model.modes.includes(productRef ? 'image_to_video' : 'text_to_video'))
      throw new Error('No supported in-registry video model.')
    const scene: AdScene = {
      index: i, role, durationSec, source: useStock ? 'stock' : 'generated',
      reason: useStock
        ? 'Suitable real stock footage covers this narrative beat.'
        : productRef
          ? 'This beat needs the actual product reference; generic stock must not impersonate it.'
          : 'No suitable real stock footage available; generation is proposed only, pending confirmation.',
      startMs: cursor, endMs: cursor + durationSec * 1000, onScreenText: cards[i],
      ...(stock ? { providerId: stock.providerId, stockQuery: query, ...stockTrim({ durationSec }, stock) }
        : { modelId: model.id, prompt: `Product: ${input.name}. ${cards[i]}. Maintain real appearance; do not invent features, packaging, logos or claims.`,
          ...(productRef ? { referenceAssetId: productRef } : {}) }),
    }
    // Generated scene length limited by splitting the run into short shots instead of requesting an invalid duration.
    if (!useStock && durationSec > 5) {
      // Split the longer beat into <=5 second materialization units while preserving the timeline.
      const first = Math.min(5, durationSec)
      const remaining = durationSec - first
      scene.durationSec = first
      scene.endMs = cursor + first * 1000
      planned.push(scene)
      console.info('[ad-studio:planner] scene_selected', { runId, sceneIndex: planned.length - 1, source: scene.source, reason: scene.reason, modelId: scene.modelId })
      cursor = scene.endMs
      if (remaining) {
        const follow: AdScene = { ...scene, index: planned.length, durationSec: remaining, startMs: cursor, endMs: cursor + remaining*1000,
          reason: 'Continuation of the confirmed product shot using a supported short generation.' }
        planned.push(follow)
        cursor = follow.endMs
        console.info('[ad-studio:planner] scene_selected', { runId, sceneIndex: follow.index, source: follow.source, reason: follow.reason, modelId: follow.modelId })
      }
      continue
    }
    scene.index = planned.length
    planned.push(scene)
    cursor = scene.endMs
    console.info('[ad-studio:planner] scene_selected', { runId, sceneIndex: scene.index, source: scene.source, reason: scene.reason, modelId: scene.modelId, providerId: scene.providerId })
  }
  if (cursor !== input.durationSec * 1000) throw new Error('Ad plan duration mismatch.')
  const outputScenes = planned.map(scene => {
    if (scene.source !== 'generated') return scene
    if (!scene.modelId) throw new Error('Generated scene is missing a registry model.')
    const window = adGenerationWindow(scene.modelId, scene.durationSec)
    console.info('[ad-studio:b3] scene_generation_window', {
      runId, index: scene.index, modelId: scene.modelId, plannedSec: scene.durationSec,
      generatedSec: window.generationDurationSec, trimInMs: window.trimInMs, trimOutMs: window.trimOutMs,
    })
    return { ...scene, ...window }
  })
  const costKey = `${mode}_${input.durationSec}` as keyof typeof AD_STUDIO_COSTS
  const plan: AdPlan = {
    script, imagery: { imageJobIds: [], preservedSourceAssetIds: [...input.imageAssetIds, ...(input.logoAssetId ? [input.logoAssetId] : [])] },
    scenes: outputScenes, creditEstimate: AD_STUDIO_COSTS[costKey],
    modelStrategy: 'Prefer approved stock and original product imagery. Use supported registry video models only for necessary short shots after confirmation.',
  }
  console.info('[ad-studio:planner] complete', { runId, count: plan.scenes.length, stock: plan.scenes.filter(s=>s.source==='stock').length, generated: plan.scenes.filter(s=>s.source==='generated').length })
  return plan
}
