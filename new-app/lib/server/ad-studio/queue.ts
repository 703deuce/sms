import 'server-only'
import { createHash } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { createDefaultStudioService } from '@/lib/studio/runtime'
import { createStudioJob, refreshStudioJob, type StudioService } from '@/lib/studio/jobs'
import type { AdPlan, AdProductInput } from '@/lib/ad-studio/types'
import { adGenerationWindow } from '@/lib/ad-studio/durations'

export type AdGenerationTick = {
  state: 'idle' | 'running' | 'failed' | 'ready_for_stitch'
  submitted: number
}

/** Stable per scene + run across HTTP restarts. A recorded ID is never automatically retried. */
export function adSceneJobId(runId: string, sceneId: string): string {
  return 'stjob_ad_' + createHash('sha256').update(runId + ':' + sceneId).digest('hex').slice(0, 32)
}

/**
 * B3b durable, bounded tick. Activated by the Ad Studio service when the full
 * handoff is wired; never creates a second paid provider task for a scene.
 * Pending/running jobs are polled using the existing Studio refresh path.
 */
export async function advanceAdStudioGeneration(
  workspaceId: string,
  runId: string,
  svc: StudioService = createDefaultStudioService(),
): Promise<AdGenerationTick> {
  console.info('[ad-studio:b3] generation_tick_begin', { runId })
  const db = getPrisma()
  const run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  if (!run || run.status !== 'generating') {
    console.info('[ad-studio:b3] generation_tick_inactive', { runId, status: run?.status })
    return { state: 'idle', submitted: 0 }
  }
  const input = run.input as unknown as AdProductInput
  const plan = run.plan as unknown as AdPlan | null
  if (!plan?.scenes?.length) throw new Error('Ad Studio generation plan is missing.')
  const scenes = await db.adStudioScene.findMany({ where: { runId }, orderBy: { index: 'asc' } })
  let submitted = 0
  let failed = false
  for (const scene of scenes) {
    if (scene.status === 'skipped' || scene.source === 'stock' || scene.status === 'ready') continue
    if (scene.status === 'failed') { failed = true; continue }
    if (scene.studioJobId) {
      const job = await svc.store.getJob(workspaceId, scene.studioJobId)
      // Claim was persisted before createTask. An absent row may be in flight; do not pay again.
      if (!job) {
        console.info('[ad-studio:b3] child_claim_pending', { runId, index: scene.index, jobId: scene.studioJobId })
        continue
      }
      const fresh = await refreshStudioJob(svc, job)
      console.info('[ad-studio:b3] child_job_polled', { runId, index: scene.index, jobId: fresh.id, status: fresh.status })
      if (fresh.status === 'done') {
        await db.adStudioScene.updateMany({
          where: { id: scene.id, runId, status: 'planned' }, data: { status: 'ready' },
        })
      } else if (fresh.status === 'failed') {
        failed = true
        await db.adStudioScene.updateMany({
          where: { id: scene.id, runId, status: 'planned' }, data: { status: 'failed' },
        })
        console.warn('[ad-studio:b3] child_failed_no_retry', { runId, index: scene.index, jobId: fresh.id })
      }
      continue
    }
    if (scene.source !== 'generated' || scene.status !== 'planned') continue
    const active = await svc.store.countActive(workspaceId, run.userId)
    if (active >= svc.concurrencyLimit) {
      console.info('[ad-studio:b3] child_wait_capacity', { runId, active, limit: svc.concurrencyLimit })
      break
    }
    const planned = plan.scenes.find(s => s.index === scene.index)
    if (!planned?.modelId || !planned.prompt) throw new Error('Ad Studio generated scene lacks a model/prompt.')
    const window = adGenerationWindow(planned.modelId, scene.durationSec)
    const jobId = adSceneJobId(runId, scene.id)
    const claimed = await db.adStudioScene.updateMany({
      where: { id: scene.id, runId, status: 'planned', studioJobId: null },
      data: { studioJobId: jobId },
    })
    if (claimed.count !== 1) continue
    // Cancellation after the claim but before the paid request stops new generation.
    const stillActive = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId, status: 'generating' }, select: { id: true } })
    if (!stillActive) {
      console.info('[ad-studio:b3] child_cancelled_before_submit', { runId, jobId })
      break
    }
    console.info('[ad-studio:b3] child_submit_begin', {
      runId, index: scene.index, jobId, source: scene.source, reason: scene.reason,
      modelId: planned.modelId, providerId: scene.providerId, generationDurationSec: window.generationDurationSec,
    })
    try {
      await createStudioJob(svc, {
        workspaceId, userId: run.userId, jobId,
        body: {
          modelId: planned.modelId, mode: planned.referenceAssetId ? 'image_to_video' : 'text_to_video',
          prompt: planned.prompt, aspect: input.aspect,
          durationSec: window.generationDurationSec,
          ...(planned.referenceAssetId ? { referenceAssetId: planned.referenceAssetId } : {}),
        },
      })
      submitted++
      console.info('[ad-studio:b3] child_submit_complete', { runId, index: scene.index, jobId })
    } catch (err) {
      // A capacity race has not issued a paid call. Safely release only an absent job claim.
      const existing = await svc.store.getJob(workspaceId, jobId)
      if (!existing && err instanceof Error && err.message.includes('Too many jobs')) {
        await db.adStudioScene.updateMany({
          where: { id: scene.id, runId, status: 'planned', studioJobId: jobId },
          data: { studioJobId: null },
        })
        console.info('[ad-studio:b3] child_capacity_race_deferred', { runId, jobId })
        break
      }
      await db.adStudioScene.updateMany({ where: { id: scene.id, runId, status: 'planned' }, data: { status: 'failed' } })
      failed = true
      console.warn('[ad-studio:b3] child_submit_failed_no_retry', { runId, index: scene.index, jobId, errorType: err instanceof Error ? err.name : typeof err })
      break
    }
  }
  if (failed) {
    await db.adStudioRun.updateMany({
      where: { id: runId, workspaceId, status: 'generating' },
      data: { status: 'failed', errorCode: 'KIE_ERROR', errorMessage: 'An ad scene could not be generated. No automatic retry was started.' },
    })
    console.warn('[ad-studio:b3] generation_failed', { runId })
    return { state: 'failed', submitted }
  }
  const latest = await db.adStudioScene.findMany({ where: { runId }, select: { source: true, status: true } })
  const ready = latest.every(s => s.status === 'ready' || s.status === 'skipped')
  console.info('[ad-studio:b3] generation_tick_complete', { runId, submitted, ready, scenes: latest.length })
  return { state: ready ? 'ready_for_stitch' : 'running', submitted }
}
