import 'server-only'
import { Prisma, type AdStudioRun as DbAdStudioRun } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { searchVideos, findCachedHit, ensureStockAsset } from '@/lib/server/ai/pixabay'
import { AD_STUDIO_COSTS } from '@/lib/ad-studio/costs'
import type { AdMode, AdPlan, AdProductInput, AdStudioRun, AdRunStatus } from '@/lib/ad-studio/types'
import { AdStudioError, adInvalid, adSafeFailure } from '@/lib/ad-studio/errors'
import { parseCreate, parseReplan, adKeySchema } from '@/lib/ad-studio/validate'
import { writeGroundedAdStoryline } from '@/lib/server/ad-studio/storyline'
import { planAdScenes } from '@/lib/ad-studio/planner-agent'
import { adCommercialReferenceId } from '@/lib/ad-studio/commercial'
import { advanceAdStudioRun, getAdStudioImages } from '@/lib/server/ad-studio/pipeline'
import { advanceAdRender, ensureAdEditorClip } from '@/lib/server/ad-studio/destination'
import type { AdImageVariant } from '@/lib/ad-studio/types'

const prisma = () => getPrisma()
const activeStatuses = ['planning','plan_ready','confirming','generating','stitching']
const maxActive = 5
const jsonValue = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
type Existing = DbAdStudioRun

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Confirmation metadata is private in plan JSON until a dedicated field is added in B3. */
type SavedPlan = AdPlan & { _confirmKey?: string; _renderRetryKey?: string }

function publicPlan(raw: unknown): AdPlan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { _confirmKey: _confirmHidden, _renderRetryKey: _retryHidden, ...plan } = raw as unknown as SavedPlan
  void _confirmHidden
  void _retryHidden
  return plan as AdPlan
}
function toView(row: Existing, imageAds?: AdImageVariant[], canRetryRender = false): AdStudioRun {
  const plan = publicPlan(row.plan)
  const done = row.status === 'done' && row.projectId && row.clipId
  const compactEditorUrl = done ? `/app/video-editor/${encodeURIComponent(row.projectId!)}/edit/${encodeURIComponent(row.clipId!)}?mode=compact` : null
  const fullEditorUrl = done ? `/app/video-editor/${encodeURIComponent(row.projectId!)}/edit/${encodeURIComponent(row.clipId!)}` : null
  return {
    id: row.id, status: row.status as AdRunStatus, mode: row.mode as AdMode,
    input: row.input as unknown as AdProductInput, plan,
    creditEstimate: row.creditEstimate, creditCharged: row.creditCharged,
    projectId: row.projectId, clipId: row.clipId, compactEditorUrl, fullEditorUrl,
    ...(imageAds ? { imageAds } : {}),
    canRetryRender,
    error: row.errorCode ? { code: row.errorCode, message: row.errorMessage || 'Ad Studio could not complete this run.' } : null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }
}
const required = async (workspaceId: string, id: string): Promise<Existing> => {
  console.info('[ad-studio:store] get_begin', { workspaceId, runId: id })
  const row = await prisma().adStudioRun.findFirst({ where: { id, workspaceId } })
  if (!row) throw new AdStudioError('RUN_NOT_FOUND','Ad run not found.',404)
  console.info('[ad-studio:store] get_complete', { runId: id, status: row.status })
  return row
}

async function canRetryFinalRender(row: Existing): Promise<boolean> {
  if (row.status !== 'failed' || row.errorCode !== 'RENDER_ERROR' || !row.projectId) return false
  const db = prisma()
  const input = row.input as unknown as AdProductInput
  console.info('[ad-studio:b3] retry_render_eligibility_begin', { runId: row.id })
  const [sceneCount, unreadyScenes, variantCount, readyVariants] = await Promise.all([
    db.adStudioScene.count({ where: { runId: row.id } }),
    db.adStudioScene.count({ where: { runId: row.id, status: { not: 'ready' } } }),
    db.adStudioImageVariant.count({ where: { runId: row.id } }),
    db.adStudioImageVariant.count({ where: { runId: row.id, status: 'ready' } }),
  ])
  const voiceReady = row.voiceoverStatus === 'ready'
    || (row.mode === 'image_ad_to_commercial' && input.voiceoverEnabled !== true && row.voiceoverStatus === 'skipped')
  const ready = sceneCount > 0
    && unreadyScenes === 0
    && variantCount === 3
    && readyVariants === variantCount
    && voiceReady
  console.info('[ad-studio:b3] retry_render_eligibility_complete', {
    runId: row.id, ready, sceneCount, unreadyScenes, variantCount, readyVariants,
    voiceoverStatus: row.voiceoverStatus,
  })
  return ready
}

async function validateAssets(workspaceId: string, input: AdProductInput): Promise<void> {
  const ids = [...new Set([...input.imageAssetIds, ...(input.logoAssetId ? [input.logoAssetId] : [])])]
  console.info('[ad-studio:assets] validate_begin', { workspaceId, count: ids.length })
  if (!ids.length) return
  const found = await prisma().aiStudioAsset.count({ where: { workspaceId, id: { in: ids }, kind: 'image' } })
  if (found !== ids.length) throw adInvalid('One or more product images do not belong to this workspace.')
  console.info('[ad-studio:assets] validate_complete', { count: found })
}

/** The selected commercial reference must come from a completed image-ad in this workspace. */
async function validateCommercialReference(workspaceId: string, input: AdProductInput): Promise<void> {
  if (!input.imageVariantId) throw adInvalid('Choose a completed image ad.')
  const variant = await prisma().adStudioImageVariant.findFirst({
    where: { id: input.imageVariantId, status: 'ready', run: { workspaceId } },
    select: { id: true, runId: true },
  })
  if (!variant || input.imageAssetIds[0] !== adCommercialReferenceId(variant.runId, variant.id))
    throw adInvalid('The chosen image ad is not ready or is not a valid reference.')
  console.info('[ad-studio:b3] commercial_reference_valid', { variantId: variant.id, workspaceId })
}

async function performPlanning(row: Existing): Promise<AdStudioRun> {
  console.info('[ad-studio:planning] begin', { runId: row.id, workspaceId: row.workspaceId, mode: row.mode })
  try {
    const input = row.input as unknown as AdProductInput
    const mode = row.mode as AdMode
    const script = await writeGroundedAdStoryline(input, mode)
    const plan = await planAdScenes({
      runId: row.id, mode, input, script,
      search: async (query) => {
        if (!query.trim()) { console.info('[ad-studio:stock] empty_query'); return [] }
        return searchVideos(query, 1)
      },
    })
    console.info('[ad-studio:planning] plan_persist_begin', { runId: row.id, scenes: plan.scenes.length })
    // One atomic replacement of scene rows and the plan; only planning state is eligible.
    const result = await prisma().$transaction(async (tx) => {
      const current = await tx.adStudioRun.findFirst({ where: { id: row.id, workspaceId: row.workspaceId } })
      if (!current || current.status !== 'planning') return current
      await tx.adStudioScene.deleteMany({ where: { runId: row.id } })
      for (const scene of plan.scenes) {
        console.info('[ad-studio:planning] scene_persist', { runId: row.id, sceneIndex: scene.index, source: scene.source, reason: scene.reason, modelId: scene.modelId, providerId: scene.providerId })
        await tx.adStudioScene.create({ data: {
          id: createId('adsc'), runId: row.id, index: scene.index, role: scene.role, durationSec: scene.durationSec,
          source: scene.source, reason: scene.reason, providerId: scene.providerId, stockQuery: scene.stockQuery,
          sourceInMs: scene.sourceInMs, sourceOutMs: scene.sourceOutMs, modelId: scene.modelId,
          prompt: scene.prompt, startMs: scene.startMs, endMs: scene.endMs, status: 'planned',
          generationDurationSec: scene.generationDurationSec, trimInMs: scene.trimInMs, trimOutMs: scene.trimOutMs,
        } })
      }
      return tx.adStudioRun.update({ where: { id: row.id }, data: {
        plan: jsonValue(plan), status: 'plan_ready', creditEstimate: plan.creditEstimate,
        errorCode: null, errorMessage: null,
      } })
    })
    if (!result) throw new AdStudioError('RUN_NOT_FOUND','Ad run not found.',404)
    console.info('[ad-studio:planning] complete', { runId: row.id, status: result.status })
    return toView(result)
  } catch (err) {
    console.error('[ad-studio:planning] failed', { runId: row.id, kind: err instanceof Error ? err.name : typeof err })
    const failure = err instanceof AdStudioError ? err : adSafeFailure(err, 'STOCK_ERROR')
    const updated = await prisma().adStudioRun.updateMany({
      where: { id: row.id, workspaceId: row.workspaceId, status: 'planning' },
      data: { status: 'failed', errorCode: failure.code, errorMessage: failure.message },
    })
    console.info('[ad-studio:planning] failed_persisted', { runId: row.id, count: updated.count })
    return toView(await required(row.workspaceId, row.id))
  }
}

export async function createAdRun(workspaceId: string, userId: string, body: unknown, headerKey?: string | null):
  Promise<{ run: AdStudioRun; created: boolean }> {
  console.info('[ad-studio:create] begin', { workspaceId })
  const { mode, input, key } = parseCreate(body, headerKey)
  let previous = await prisma().adStudioRun.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } } })
  if (previous) {
    if (previous.mode !== mode || canonicalJson(previous.input) !== canonicalJson(input))
      throw new AdStudioError('INVALID_PARAMS', 'The idempotency key was already used for another brief.', 409)
    console.info('[ad-studio:create] idempotent_replay', { runId: previous.id })
    return { run: toView(previous), created: false }
  }
  await validateAssets(workspaceId, input)
  if (mode === 'image_ad_to_commercial') await validateCommercialReference(workspaceId, input)
  const active = await prisma().adStudioRun.count({ where: { workspaceId, status: { in: activeStatuses } } })
  if (active >= maxActive) throw new AdStudioError('CONCURRENCY_LIMIT','Too many ad runs are active. Finish an existing run before starting another.',409)
  try {
    previous = await prisma().adStudioRun.create({ data: {
      id: createId('adrun'), workspaceId, userId, mode, status: 'planning',
      idempotencyKey: key, input: jsonValue(input), plan: Prisma.JsonNull, creditCharged: null, creditEstimate: null,
    } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma().adStudioRun.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } } })
      if (!existing || existing.mode !== mode || canonicalJson(existing.input) !== canonicalJson(input))
        throw new AdStudioError('INVALID_PARAMS', 'That idempotency key is already in use.', 409)
      console.info('[ad-studio:create] concurrent_replay', { runId: existing.id })
      return { run: toView(existing), created: false }
    }
    throw err
  }
  console.info('[ad-studio:create] persisted', { runId: previous.id, status: previous.status })
  const run = await performPlanning(previous)
  console.info('[ad-studio:create] complete', { runId: run.id, status: run.status })
  return { run, created: true }
}

export async function getAdRun(workspaceId: string, id: string): Promise<AdStudioRun> {
  console.info('[ad-studio:get] begin', { runId: id })
  const row = await required(workspaceId, id)
  if (row.status === 'planning') return performPlanning(row)
  if (row.status === 'generating' || row.status === 'stitching') {
    await advanceAdStudioRun(workspaceId, id)
  }
  const fresh = await required(workspaceId, id)
  const imageAds = ['generating','stitching','done','failed'].includes(fresh.status)
    ? await getAdStudioImages(id) : undefined
  const canRetryRender = await canRetryFinalRender(fresh)
  console.info('[ad-studio:b3] run_refresh_complete', {
    runId: id, status: fresh.status, images: imageAds?.length, canRetryRender,
  })
  return toView(fresh, imageAds, canRetryRender)
}

export async function listAdRuns(workspaceId: string, query: { limit?: string | null; cursor?: string | null; status?: string | null }):
 Promise<{ runs: AdStudioRun[]; nextCursor: string | null }> {
  console.info('[ad-studio:list] begin', { workspaceId, status: query.status })
  const limit = query.limit ? Number(query.limit) : 20
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw adInvalid('Limit must be between 1 and 50.')
  if (query.status && !['draft','planning','plan_ready','confirming','generating','stitching','done','failed','cancelled'].includes(query.status))
    throw adInvalid('Unknown status filter.')
  const rows = await prisma().adStudioRun.findMany({
    where: { workspaceId, ...(query.status ? { status: query.status } : {}) },
    take: limit + 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  })
  const nextCursor = rows.length > limit ? rows[limit - 1]!.id : null
  console.info('[ad-studio:list] complete', { workspaceId, count: Math.min(rows.length, limit), next: Boolean(nextCursor) })
  return { runs: rows.slice(0,limit).map(toView), nextCursor }
}

export async function replanAdRun(workspaceId: string, id: string, body: unknown): Promise<AdStudioRun> {
  console.info('[ad-studio:replan] begin', { runId: id })
  const row = await required(workspaceId,id)
  if (!['draft','plan_ready'].includes(row.status)) throw new AdStudioError('PLAN_NOT_READY','This ad cannot be replanned in its current state.',409)
  const input = parseReplan(body, row.input as unknown as AdProductInput, row.mode as AdMode)
  await validateAssets(workspaceId, input)
  if (row.mode === 'image_ad_to_commercial') await validateCommercialReference(workspaceId, input)
  const claimed = await prisma().adStudioRun.updateMany({
    where: { id, workspaceId, status: row.status },
    data: { input: jsonValue(input), status: 'planning', plan: Prisma.JsonNull, creditEstimate: null, errorCode: null, errorMessage: null },
  })
  if (claimed.count !== 1) throw new AdStudioError('PLAN_NOT_READY','This ad changed while replanning. Refresh and try again.',409)
  console.info('[ad-studio:replan] reset_to_planning', { runId: id })
  return performPlanning(await required(workspaceId,id))
}

async function prepareStock(workspaceId: string, runId: string, plan: AdPlan): Promise<void> {
  for (const scene of plan.scenes.filter(s=>s.source === 'stock')) {
    console.info('[ad-studio:confirm] stock_materialize_begin', { runId, sceneIndex: scene.index, providerId: scene.providerId })
    if (!scene.providerId) throw new AdStudioError('STOCK_ERROR','The selected stock footage is no longer available.',502)
    const hit = await findCachedHit(scene.providerId)
    if (!hit) throw new AdStudioError('STOCK_ERROR','Stock footage expired. Re-plan this ad to select new footage.',502)
    const from = scene.sourceInMs ?? 0, to = scene.sourceOutMs ?? scene.durationSec*1000
    if (from < 0 || to - from !== scene.durationSec * 1000 || to > hit.durationS*1000)
      throw new AdStudioError('STOCK_ERROR','Selected stock footage cannot cover its planned duration.',502)
    const { asset } = await ensureStockAsset(hit)
    const update = await prisma().adStudioScene.updateMany({
      where: { runId, index: scene.index }, data: { stockAssetId: asset.id, status: 'ready' },
    })
    if (update.count !== 1) throw new AdStudioError('STORAGE_ERROR','Could not save the selected stock footage.',500)
    console.info('[ad-studio:confirm] stock_materialize_complete', { runId, sceneIndex: scene.index, stockAssetId: asset.id, sourceInMs: from, sourceOutMs: to })
  }
}

export async function confirmAdRun(workspaceId: string, id: string, keyValue: unknown): Promise<AdStudioRun> {
  console.info('[ad-studio:confirm] begin', { runId: id })
  const key = adKeySchema.safeParse(keyValue)
  if (!key.success) throw adInvalid('An idempotency key is required for confirmation.')
  const row = await required(workspaceId, id)
  const saved = row.plan as unknown as SavedPlan | null
  if (row.status !== 'plan_ready') {
    if (saved?._confirmKey === key.data && ['confirming','generating','stitching','done','failed'].includes(row.status)) {
      console.info('[ad-studio:confirm] idempotent_replay', { runId: id, status: row.status })
      return toView(row)
    }
    throw new AdStudioError(row.status === 'draft' || row.status === 'planning' ? 'PLAN_NOT_READY' : 'ALREADY_CONFIRMED',
      row.status === 'draft' || row.status === 'planning' ? 'Wait for the ad plan before confirming.' : 'This ad was already confirmed with another key.',409)
  }
  if (!saved || !Array.isArray(saved.scenes)) throw new AdStudioError('PLAN_NOT_READY','The ad plan is missing. Please re-plan.',409)
  const nextPlan = { ...saved, _confirmKey: key.data }
  // CAS prevents two different keys from simultaneously starting the same run.
  const won = await prisma().adStudioRun.updateMany({ where: { id, workspaceId, status: 'plan_ready' },
    data: { status: 'confirming', plan: jsonValue(nextPlan) } })
  if (!won.count) return confirmAdRun(workspaceId, id, key.data)
  console.info('[ad-studio:confirm] claimed', { runId: id })
  try {
    // B2 prepares only stock. B3 creates paid AiStudioJobs, stitch and render workers.
    await prepareStock(workspaceId, id, saved)
    const committed = await prisma().adStudioRun.updateMany({
      where: { id, workspaceId, status: 'confirming' },
      data: { status: 'generating', errorCode: null, errorMessage: null },
    })
    console.info('[ad-studio:b3] confirm_generation_ready', { runId: id, count: committed.count })
    if (committed.count) {
      await advanceAdStudioRun(workspaceId, id)
    }
    const latest = await required(workspaceId, id)
    return toView(latest, await getAdStudioImages(id))
  } catch (err) {
    console.error('[ad-studio:confirm] stock_failed', { runId: id, type: err instanceof Error ? err.name : typeof err })
    const failure = err instanceof AdStudioError ? err : adSafeFailure(err,'STOCK_ERROR')
    await prisma().adStudioRun.updateMany({ where: { id, workspaceId, status: 'confirming' },
      data: { status: 'failed', errorCode: failure.code, errorMessage: failure.message },
    })
    return toView(await required(workspaceId, id))
  }
}

/**
 * Continue a failed video without the failed shots; no paid KIE job is retried.
 * Image-variant failures remain blocked because every finished run needs 3 variants.
 */
export async function continueAdRun(workspaceId: string, id: string): Promise<AdStudioRun> {
  const db = prisma()
  const run = await required(workspaceId, id)
  if (run.status !== 'failed' || run.errorCode !== 'KIE_ERROR')
    throw new AdStudioError('INVALID_PARAMS', 'Only a failed generation can continue without scenes.', 409)
  const imageFailures = await db.adStudioImageVariant.count({ where: { runId: id, status: 'failed' } })
  if (imageFailures) throw new AdStudioError('INVALID_PARAMS', 'A failed image-ad variant needs a new confirmed run.', 409)
  const failedScenes = await db.adStudioScene.count({ where: { runId: id, status: 'failed' } })
  if (!failedScenes) throw new AdStudioError('INVALID_PARAMS', 'No failed ad scenes can be skipped.', 409)
  console.info('[ad-studio:b3] continue_without_failed_scenes_begin', { runId: id, failedScenes })
  await db.$transaction(async tx => {
    const claimed = await tx.adStudioRun.updateMany({
      where: { id, workspaceId, status: 'failed', errorCode: 'KIE_ERROR' },
      data: { status: 'generating', errorCode: null, errorMessage: null },
    })
    if (!claimed.count) return
    await tx.adStudioScene.updateMany({ where: { runId: id, status: 'failed' }, data: { status: 'skipped' } })
  })
  await advanceAdStudioRun(workspaceId, id)
  const updated = await required(workspaceId, id)
  console.info('[ad-studio:b3] continue_without_failed_scenes_complete', { runId: id, status: updated.status })
  return toView(updated, await getAdStudioImages(id))
}

/** User-click-only retry of the already-generated final render. Never resubmits paid generation or voiceover. */
export async function retryAdRender(workspaceId: string, id: string, keyValue: unknown): Promise<AdStudioRun> {
  console.info('[ad-studio:b3] retry_render_begin', { runId: id })
  const key = adKeySchema.safeParse(keyValue)
  if (!key.success) throw adInvalid('An idempotency key is required for render retry.')

  let row = await required(workspaceId, id)
  const saved = row.plan as unknown as SavedPlan | null
  if (saved?._renderRetryKey === key.data && ['stitching','done','failed'].includes(row.status)) {
    console.info('[ad-studio:b3] retry_render_idempotent_replay', { runId: id, status: row.status })
    if (row.status === 'stitching') {
      const clipId = await ensureAdEditorClip(workspaceId, id)
      if (clipId) await advanceAdRender(workspaceId, id)
      row = await required(workspaceId, id)
    }
    return toView(row, await getAdStudioImages(id), await canRetryFinalRender(row))
  }

  if (row.status !== 'failed' || row.errorCode !== 'RENDER_ERROR') {
    throw new AdStudioError('INVALID_PARAMS', 'Only a failed final render can be retried.', 409)
  }
  if (!saved || !(await canRetryFinalRender(row))) {
    throw new AdStudioError('INVALID_PARAMS', 'The generated outputs are not complete enough to retry only the final render.', 409)
  }

  const nextPlan: SavedPlan = { ...saved, _renderRetryKey: key.data }
  const claimed = await prisma().adStudioRun.updateMany({
    where: { id, workspaceId, status: 'failed', errorCode: 'RENDER_ERROR' },
    data: {
      status: 'stitching', renderId: null, renderJobId: null, renderStatus: null,
      errorCode: null, errorMessage: null, completedAt: null, plan: jsonValue(nextPlan),
    },
  })
  if (!claimed.count) return retryAdRender(workspaceId, id, key.data)
  console.info('[ad-studio:b3] retry_render_claimed', { runId: id })

  try {
    const clipId = await ensureAdEditorClip(workspaceId, id)
    if (!clipId) throw new Error('Destination clip unavailable')
    await advanceAdRender(workspaceId, id)
    console.info('[ad-studio:b3] retry_render_queued', { runId: id, clipId })
  } catch (err) {
    console.warn('[ad-studio:b3] retry_render_failed', {
      runId: id, type: err instanceof Error ? err.name : typeof err,
    })
    await prisma().adStudioRun.updateMany({
      where: { id, workspaceId, status: 'stitching' },
      data: {
        status: 'failed', renderStatus: 'failed', errorCode: 'RENDER_ERROR',
        errorMessage: 'Ad Studio could not retry the final render.',
      },
    })
  }

  row = await required(workspaceId, id)
  return toView(row, await getAdStudioImages(id), await canRetryFinalRender(row))
}

export async function cancelAdRun(workspaceId: string, id: string): Promise<AdStudioRun> {
  console.info('[ad-studio:cancel] begin', { runId: id })
  const row = await required(workspaceId,id)
  if (row.status === 'done' || row.status === 'cancelled') return toView(row)
  const updated = await prisma().adStudioRun.updateMany({
    where: { id, workspaceId, status: { notIn: ['done','cancelled'] } },
    data: { status: 'cancelled', completedAt: new Date() },
  })
  console.info('[ad-studio:cancel] update_complete', { runId: id, count: updated.count })
  return toView(await required(workspaceId,id))
}

export const adStudioConfig = () => ({
  version: 1 as const, aspects: ['9:16','16:9','1:1'] as const,
  durationsSec: [15,30] as const, modes: ['storyline','image_to_ad','image_ad_to_commercial'] as const,
  costs: AD_STUDIO_COSTS,
})
