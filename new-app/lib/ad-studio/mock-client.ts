import { AD_STUDIO_COSTS, estimateCredits } from './costs'
import { compactEditorUrl, fullEditorUrl } from './format'
import type { AdStudioClient, CreateAdStudioRunInput } from './client'
import type {
  AdPlan,
  AdProductInput,
  AdScene,
  AdStudioConfig,
  AdStudioHistoryItem,
  AdStudioMode,
  AdStudioRun,
  AdStudioStatus,
} from './types'
import { AdStudioHttpError } from './types'

function nowIso() {
  return new Date().toISOString()
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function copy<T>(value: T): T {
  return structuredClone(value)
}

function buildPlan(mode: AdStudioMode, input: AdProductInput, creditEstimate: number | null): AdPlan {
  const product = input.name.trim() || 'this product'
  const point = input.sellingPoints[0]?.trim() || 'it works'
  const duration = input.durationSec
  const hookSec = 3
  const problemSec = mode === 'image_to_ad' ? 4 : 5
  const solutionSec = Math.max(4, duration - hookSec - problemSec - 4)
  const ctaSec = 4
  let cursor = 0
  const scene = (
    index: number,
    role: AdScene['role'],
    durationSec: number,
    source: AdScene['source'],
    reason: string,
    extra: Partial<AdScene> = {},
  ): AdScene => {
    const startMs = cursor * 1000
    cursor += durationSec
    return {
      index,
      role,
      durationSec,
      source,
      reason,
      startMs,
      endMs: startMs + durationSec * 1000,
      status: 'planned',
      ...extra,
    }
  }
  const scenes: AdScene[] = [
    scene(0, 'hook', hookSec, 'stock', 'Stock open establishes the setting without a paid shot.', {
      providerId: 'pixabay',
      stockQuery: `${product} lifestyle`,
      onScreenText: product,
    }),
    scene(1, 'problem', problemSec, 'stock', 'Stock B-roll covers the problem beat; no product motion is required.', {
      providerId: 'pixabay',
      stockQuery: 'frustrated everyday task',
    }),
    scene(2, 'solution', solutionSec, 'generated', 'The product must be shown in motion, which stock and stills cannot do.', {
      modelId: 'veo-3.1-lite',
      prompt: `${product} demonstrating ${point}, ${input.aspect}`,
      referenceAssetId: input.imageAssetIds[0],
    }),
    scene(3, 'cta', ctaSec, 'stock', 'A stock end-card style shot is enough for the call to action.', {
      providerId: 'pixabay',
      stockQuery: 'shop now end card',
      onScreenText: 'Get it now',
    }),
  ]
  return {
    script: {
      hook: `Meet ${product}.`,
      problem: `The usual way falls short when you need ${point}.`,
      solution: `${product} is built for that.`,
      cta: 'Get it now.',
      voiceover: `Meet ${product}. The usual way falls short when you need ${point}. ${product} is built for that. Get it now.`,
      onScreenText: [product, point, 'Get it now'],
    },
    imagery: {
      imageJobIds: [],
      preservedSourceAssetIds: [...input.imageAssetIds],
    },
    scenes,
    creditEstimate,
    modelStrategy: 'Stock for hook, problem, and CTA. One short veo-3.1-lite shot for the product solution.',
  }
}

const PRIOR_HISTORY: AdStudioHistoryItem[] = [
  { id: 'job_hist_1', title: 'Prior product still', kind: 'studio_job', status: 'completed', createdAt: '2026-11-01T12:00:00.000Z' },
  { id: 'job_hist_2', title: 'Prior clip render', kind: 'studio_job', status: 'completed', createdAt: '2026-11-02T15:30:00.000Z' },
]

export type MockAdStudioOptions = {
  /** When true, the next getRun after a status change advances planning/generating automatically. */
  autoAdvance?: boolean
}

/**
 * In-memory ad-studio client. Never calls /api/studio/jobs, KIE, or any provider.
 * F1 UI ships against this only.
 */
export function createMockAdStudioClient(options: MockAdStudioOptions = {}): AdStudioClient {
  const autoAdvance = options.autoAdvance !== false
  const runs = new Map<string, AdStudioRun>()
  const createKeys = new Map<string, string>()
  const confirmKeys = new Map<string, string>()
  const pollTicks = new Map<string, number>()
  let seq = 0

  function stamp(run: AdStudioRun, patch: Partial<AdStudioRun>): AdStudioRun {
    const next: AdStudioRun = { ...run, ...patch, updatedAt: nowIso() }
    runs.set(next.id, next)
    return copy(next)
  }

  function maybeAdvance(run: AdStudioRun): AdStudioRun {
    if (!autoAdvance) return copy(run)
    const ticks = (pollTicks.get(run.id) ?? 0) + 1
    pollTicks.set(run.id, ticks)
    if (run.status === 'planning' && ticks >= 1) {
      const plan = run.plan ?? buildPlan(run.mode, run.input, run.creditEstimate)
      return stamp(run, { status: 'plan_ready', plan, creditEstimate: plan.creditEstimate })
    }
    if (run.status === 'generating' && ticks >= 1) {
      const plan = run.plan
      const scenes = plan?.scenes.map((s) => ({ ...s, status: 'ready' as const })) ?? []
      return stamp(run, { status: 'stitching', plan: plan ? { ...plan, scenes } : plan })
    }
    if (run.status === 'stitching' && ticks >= 1) {
      const projectId = run.projectId ?? `proj_${run.id}`
      const clipId = run.clipId ?? `clip_${run.id}`
      return stamp(run, {
        status: 'done',
        projectId,
        clipId,
        compactEditorUrl: compactEditorUrl(projectId, clipId),
        fullEditorUrl: fullEditorUrl(projectId, clipId),
        completedAt: nowIso(),
      })
    }
    return copy(run)
  }

  const client: AdStudioClient = {
    async getConfig(): Promise<AdStudioConfig> {
      return {
        version: 1,
        aspects: ['9:16', '16:9', '1:1'],
        durationsSec: [15, 30],
        costs: { ...AD_STUDIO_COSTS },
      }
    },

    async createRun(body: CreateAdStudioRunInput): Promise<AdStudioRun> {
      if (body.mode !== 'storyline' && body.mode !== 'image_to_ad') {
        throw new AdStudioHttpError(400, 'INVALID_PARAMS', 'Unknown mode')
      }
      if (!body.input.name.trim()) {
        throw new AdStudioHttpError(400, 'INVALID_PARAMS', 'Product name is required')
      }
      if (body.mode === 'image_to_ad' && body.input.imageAssetIds.length === 0) {
        throw new AdStudioHttpError(400, 'INVALID_PARAMS', 'Image-to-ad needs at least one product image')
      }
      const existingId = createKeys.get(body.idempotencyKey)
      if (existingId) {
        const existing = runs.get(existingId)
        if (existing) return copy(existing)
      }
      seq += 1
      const id = `run_mock_${seq}`
      const creditEstimate = estimateCredits(body.mode, body.input.durationSec)
      const run: AdStudioRun = {
        id,
        status: 'planning',
        mode: body.mode,
        input: copy(body.input),
        plan: null,
        creditEstimate,
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
      pollTicks.set(id, 0)
      return copy(run)
    },

    async getRun(runId: string): Promise<AdStudioRun> {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found')
      return maybeAdvance(run)
    },

    async listRuns(): Promise<AdStudioRun[]> {
      return [...runs.values()].map(copy).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async listHistory(): Promise<AdStudioHistoryItem[]> {
      const fromRuns: AdStudioHistoryItem[] = [...runs.values()].map((run) => ({
        id: run.id,
        title: run.input.name,
        kind: 'ad_run',
        status: run.status,
        createdAt: run.createdAt,
      }))
      return [...fromRuns, ...PRIOR_HISTORY]
    },

    async replan(runId: string, input?: Partial<AdProductInput>): Promise<AdStudioRun> {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found')
      if (run.status !== 'plan_ready' && run.status !== 'draft') {
        throw new AdStudioHttpError(409, 'PLAN_NOT_READY', 'Re-plan is only available before confirm')
      }
      const nextInput = { ...run.input, ...input }
      const creditEstimate = estimateCredits(run.mode, nextInput.durationSec)
      pollTicks.set(runId, 0)
      return stamp(run, {
        status: 'planning',
        input: nextInput,
        plan: null,
        creditEstimate,
        error: null,
      })
    },

    async confirm(runId: string, idempotencyKey: string): Promise<AdStudioRun> {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found')
      const prior = confirmKeys.get(runId)
      if (prior && prior === idempotencyKey) {
        return copy(run)
      }
      if (prior && prior !== idempotencyKey) {
        throw new AdStudioHttpError(409, 'ALREADY_CONFIRMED', 'This run was already confirmed')
      }
      if (run.status !== 'plan_ready') {
        throw new AdStudioHttpError(409, 'PLAN_NOT_READY', 'Confirm is only available when the plan is ready')
      }
      confirmKeys.set(runId, idempotencyKey)
      pollTicks.set(runId, 0)
      return stamp(run, { status: 'generating' })
    },

    async cancel(runId: string): Promise<AdStudioRun> {
      const run = runs.get(runId)
      if (!run) throw new AdStudioHttpError(404, 'RUN_NOT_FOUND', 'Run not found')
      if (run.status === 'done') return copy(run)
      return stamp(run, { status: 'cancelled' })
    },
  }
  return client
}
