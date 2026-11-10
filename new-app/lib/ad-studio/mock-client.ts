import { AdStudioHttpError, type AdStudioClient, type AdStudioConfig, type CreateAdStudioRunInput } from './client'
import type { AdImageVariant, AdMode, AdPlan, AdProductInput, AdStudioRun } from './types'

function nowIso() {
  return new Date().toISOString()
}

function copy<T>(value: T): T {
  return structuredClone(value)
}

function planFor(mode: AdMode, input: AdProductInput): AdPlan {
  const name = input.name.trim() || 'Product'
  const point = input.sellingPoints[0] || 'a better result'
  const durationSec = input.durationSec
  const split = durationSec === 15 ? [3, 4, 5, 3] : [4, 8, 12, 6]
  let cursor = 0
  const scene = (
    index: number,
    role: AdPlan['scenes'][number]['role'],
    source: AdPlan['scenes'][number]['source'],
    seconds: number,
    reason: string,
  ): AdPlan['scenes'][number] => {
    const startMs = cursor
    const endMs = startMs + seconds * 1000
    cursor = endMs
    return {
      index,
      role,
      durationSec: seconds,
      source,
      reason,
      startMs,
      endMs,
      ...(source === 'stock'
        ? { providerId: `stock_${index}`, stockQuery: `${name} lifestyle` }
        : { modelId: 'mock-video-model', prompt: `${name}: ${point}` }),
    }
  }
  return {
    script: {
      hook: `Meet ${name}.`,
      problem: `The old way makes ${point} harder.`,
      solution: `${name} makes it simple.`,
      cta: 'Try it today.',
      voiceover: `Meet ${name}. ${name} makes it simple. Try it today.`,
      onScreenText: [name, point, 'Try it today'],
    },
    imagery: { imageJobIds: [], preservedSourceAssetIds: [...input.imageAssetIds] },
    scenes: [
      scene(0, 'hook', 'stock', split[0]!, 'Use stock to establish the hook.'),
      scene(1, 'problem', 'stock', split[1]!, 'Use stock for the problem beat.'),
      scene(2, 'solution', 'generated', split[2]!, 'Generate the product payoff.'),
      scene(3, 'cta', 'stock', split[3]!, 'Use stock for the CTA.'),
    ],
    creditEstimate: null,
    modelStrategy: mode === 'image_ad_to_commercial' ? 'Animate the selected image ad.' : 'Mix stock and generated footage.',
    voiceId: input.voiceId,
    voiceoverEnabled: input.voiceoverEnabled,
  }
}

function variantsFor(runId: string): AdImageVariant[] {
  return [0, 1, 2].map((index) => ({
    id: `variant_${runId}_${index}`,
    index,
    headline: ['Make it easier', 'Built to stand out', 'Your next favorite'][index]!,
    cta: 'Shop now',
    modelId: 'mock-image-model',
    studioJobId: `studio_${runId}_${index}`,
    status: 'ready' as const,
    downloadUrl: null,
  }))
}

export function createMockAdStudioClient(options: { autoAdvance?: boolean } = {}): AdStudioClient {
  const autoAdvance = options.autoAdvance !== false
  const runs = new Map<string, AdStudioRun>()
  const createKeys = new Map<string, string>()
  const confirmKeys = new Map<string, string>()
  const retryRenderKeys = new Map<string, string>()
  const ticks = new Map<string, number>()
  let seq = 0
  let assetSeq = 0

  const save = (run: AdStudioRun, patch: Partial<AdStudioRun>): AdStudioRun => {
    const next = { ...run, ...patch, updatedAt: nowIso() }
    runs.set(next.id, next)
    return copy(next)
  }

  const makeRun = (body: CreateAdStudioRunInput): AdStudioRun => {
    seq += 1
    const id = `run_mock_${seq}`
    const run: AdStudioRun = {
      id,
      status: 'planning',
      mode: body.mode,
      input: copy(body.input),
      plan: null,
      creditEstimate: null,
      creditCharged: null,
      projectId: null,
      clipId: null,
      compactEditorUrl: null,
      fullEditorUrl: null,
      error: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
    }
    runs.set(id, run)
    createKeys.set(body.idempotencyKey, id)
    ticks.set(id, 0)
    return copy(run)
  }

  const advance = (run: AdStudioRun): AdStudioRun => {
    if (!autoAdvance) return copy(run)
    const tick = (ticks.get(run.id) ?? 0) + 1
    ticks.set(run.id, tick)
    if (run.status === 'planning') {
      const plan = planFor(run.mode, run.input)
      return save(run, { status: 'plan_ready', plan, creditEstimate: plan.creditEstimate })
    }
    if (run.status === 'generating') {
      return save(run, { status: 'stitching', imageAds: variantsFor(run.id) })
    }
    if (run.status === 'stitching') {
      const projectId = `proj_${run.id}`
      const clipId = `clip_${run.id}`
      return save(run, {
        status: 'done',
        imageAds: run.imageAds ?? variantsFor(run.id),
        projectId,
        clipId,
        compactEditorUrl: `/app/video-editor/${projectId}/edit/${clipId}?mode=compact`,
        fullEditorUrl: `/app/video-editor/${projectId}/edit/${clipId}`,
        completedAt: nowIso(),
      })
    }
    return copy(run)
  }

  const config: AdStudioConfig = {
    version: 1,
    aspects: ['9:16', '16:9', '1:1'],
    durationsSec: [15, 30],
    modes: ['storyline', 'image_to_ad', 'image_ad_to_commercial'],
    costs: {
      storyline_15: null,
      storyline_30: null,
      image_to_ad_15: null,
      image_to_ad_30: null,
    },
  }

  return {
    async getConfig() {
      return copy(config)
    },

    async createRun(body) {
      const previousId = createKeys.get(body.idempotencyKey)
      if (previousId) {
        const previous = runs.get(previousId)
        if (previous) return copy(previous)
      }
      if (!body.input.name.trim()) throw new AdStudioHttpError(400, 'INVALID_PARAMS', 'Product name is required.')
      if (body.mode === 'storyline' && body.input.sellingPoints.length === 0) {
        throw new AdStudioHttpError(400, 'INVALID_PARAMS', 'Add at least one selling point.')
      }
      if (body.mode === 'image_to_ad' && body.input.imageAssetIds.length === 0) {
        throw new AdStudioHttpError(400, 'INVALID_PARAMS', 'Image-to-ad requires an image.')
      }
      return makeRun(body)
    },

    async getRun(runId) {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found.')
      return advance(run)
    },

    async listRuns() {
      return {
        runs: [...runs.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(copy),
        nextCursor: null,
      }
    },

    async replan(runId, input = {}) {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found.')
      if (run.status !== 'plan_ready' && run.status !== 'draft') {
        throw new AdStudioHttpError(409, 'PLAN_NOT_READY', 'This run cannot be replanned now.')
      }
      ticks.set(runId, 0)
      return save(run, {
        status: 'planning',
        input: { ...run.input, ...input },
        plan: null,
        creditEstimate: null,
        error: null,
      })
    },

    async confirm(runId, key) {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found.')
      const prior = confirmKeys.get(runId)
      if (prior === key) return copy(run)
      if (prior && prior !== key) throw new AdStudioHttpError(409, 'ALREADY_CONFIRMED', 'This run was already confirmed.')
      if (run.status !== 'plan_ready') throw new AdStudioHttpError(409, 'PLAN_NOT_READY', 'Wait for the plan.')
      confirmKeys.set(runId, key)
      ticks.set(runId, 0)
      return save(run, { status: 'generating', imageAds: variantsFor(run.id) })
    },

    async cancel(runId) {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found.')
      return save(run, { status: 'cancelled', completedAt: nowIso() })
    },

    async continueRun(runId) {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found.')
      if (run.status !== 'failed' || run.error?.code !== 'KIE_ERROR') {
        throw new AdStudioHttpError(409, 'INVALID_PARAMS', 'Only failed video generation can continue.')
      }
      ticks.set(runId, 0)
      return save(run, { status: 'generating', error: null })
    },

    async retryRender(runId, key) {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found.')
      const prior = retryRenderKeys.get(runId)
      if (prior === key && (run.status === 'stitching' || run.status === 'done')) return copy(run)
      if (run.status !== 'failed' || run.error?.code !== 'RENDER_ERROR' || run.canRetryRender !== true) {
        throw new AdStudioHttpError(409, 'INVALID_PARAMS', 'Only a completed-generation render failure can be retried.')
      }
      retryRenderKeys.set(runId, key)
      ticks.set(runId, 0)
      return save(run, { status: 'stitching', error: null, canRetryRender: false, completedAt: null })
    },

    async getFinalRender(runId) {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found.')
      if (run.status !== 'done') throw new AdStudioHttpError(409, 'RENDER_ERROR', 'Final render is not ready.')
      return { url: `/mock-ad-studio/${runId}.mp4`, filename: `${run.input.name || 'ad-studio'}.mp4` }
    },

    async createCommercial(runId, body) {
      const parent = runs.get(runId)
      if (!parent) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found.')
      const variant = parent.imageAds?.find((item) => item.id === body.variantId && item.status === 'ready')
      if (!variant) throw new AdStudioHttpError(400, 'INVALID_PARAMS', 'Choose a completed image ad.')
      const referenceId = `asset_commercial_${variant.id}`
      const child = makeRun({
        mode: 'image_ad_to_commercial',
        idempotencyKey: body.idempotencyKey,
        input: {
          ...parent.input,
          imageAssetIds: [referenceId, ...parent.input.imageAssetIds].slice(0, 15),
          imageVariantId: variant.id,
          voiceId: body.voiceId ?? parent.input.voiceId,
          voiceoverEnabled: body.voiceoverEnabled ?? parent.input.voiceoverEnabled,
        },
      })
      return { run: save(child, { status: 'plan_ready', plan: planFor('image_ad_to_commercial', child.input) }), created: true }
    },

    async uploadImage() {
      assetSeq += 1
      return `asset_mock_${assetSeq}`
    },
  }
}
