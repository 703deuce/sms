import 'server-only'
import { createHash } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { createDefaultStudioService } from '@/lib/studio/runtime'
import { createStudioJob, refreshStudioJob, type StudioService } from '@/lib/studio/jobs'
import { adVariantCopy, adVariantPrompt } from '@/lib/ad-studio/image-variants'
import type { AdPlan, AdProductInput, AdImageVariant } from '@/lib/ad-studio/types'
import { inlineStoredImage, reviewPhotoAdForQc } from '@/lib/server/ad-studio/photo-ads'
import { studioOutputUrls } from '@/lib/studio/serialize'

const idFor = (prefix: string, key: string) => prefix + createHash('sha256').update(key).digest('hex').slice(0, 32)

export async function ensureAdImageVariants(runId: string, input: AdProductInput): Promise<void> {
  const db = getPrisma()
  const run = await db.adStudioRun.findUnique({ where: { id: runId }, select: { mode: true } })
  const photoAds = run?.mode === 'image_to_ad'
  const count = photoAds ? 5 : 3
  console.info('[ad-studio:r5] image_variants_ensure_begin', { runId, count, photoAds })
  for (let index = 0; index < count; index++) {
    const copy = photoAds ? { headline: input.headline || input.name, cta: input.cta || '' } : adVariantCopy(input, index)
    const { headline, cta } = copy
    const modelId = photoAds ? 'nano-banana-pro' : input.imageAssetIds[0] ? 'nano-banana-pro' : 'flux-2-pro'
    await db.adStudioImageVariant.upsert({
      where: { runId_index: { runId, index } },
      create: { id: idFor('adiv_', runId + ':' + index), runId, index, headline, cta, modelId, status: 'planned' },
      update: {},
    })
    console.info('[ad-studio:b3] image_variant_prepared', { runId, index, modelId })
  }
}

export async function listAdImageVariants(runId: string): Promise<AdImageVariant[]> {
  const db = getPrisma()
  const [rows, run] = await Promise.all([
    db.adStudioImageVariant.findMany({ where: { runId }, orderBy: { index: 'asc' } }),
    db.adStudioRun.findUnique({ where: { id: runId }, select: { plan: true } }),
  ])
  const plan = run?.plan as unknown as AdPlan | null
  return rows.map(v => ({ id: v.id, index: v.index, headline: v.headline, cta: v.cta,
    modelId: v.modelId, studioJobId: v.studioJobId, status: v.status as AdImageVariant['status'],
    downloadUrl: v.status === 'ready' && v.studioJobId ? studioOutputUrls(v.studioJobId).downloadUrl : null,
    qc: plan?.photoAds?.qcByIndex?.[String(v.index)] ?? null }))
}

/** B3c uses B3b's three-slot job path; claims persist BEFORE createTask. */
export async function advanceAdImageVariants(
  workspaceId: string, runId: string, svc: StudioService = createDefaultStudioService(),
): Promise<'idle' | 'running' | 'ready' | 'failed'> {
  const db = getPrisma()
  const run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  if (!run || run.status !== 'generating') return 'idle'
  const input = run.input as unknown as AdProductInput
  const plan = run.plan as unknown as AdPlan | null
  const photoAds = run.mode === 'image_to_ad'
  const expectedCount = photoAds ? 5 : 3
  const variants = await db.adStudioImageVariant.findMany({ where: { runId }, orderBy: { index: 'asc' } })
  if (variants.length !== expectedCount) throw new Error('Image ad variants were not prepared.')
  console.info('[ad-studio:r5] image_variants_tick_begin', { runId, count: variants.length, photoAds })
  let failed = false
  for (const variant of variants) {
    if (variant.status === 'ready') continue
    if (variant.status === 'failed') { failed = true; continue }
    if (variant.studioJobId) {
      const job = await svc.store.getJob(workspaceId, variant.studioJobId)
      if (!job) { console.info('[ad-studio:b3] image_claim_pending', { runId, index: variant.index }); continue }
      const fresh = await refreshStudioJob(svc, job)
      console.info('[ad-studio:b3] image_job_polled', { runId, index: variant.index, jobId: fresh.id, status: fresh.status })
      if (fresh.status === 'done') await db.adStudioImageVariant.updateMany({
        where: { id: variant.id, runId, status: 'planned' }, data: { status: 'ready' },
      })
      else if (fresh.status === 'failed') {
        failed = true
        await db.adStudioImageVariant.updateMany({ where: { id: variant.id, runId, status: 'planned' }, data: { status: 'failed' } })
        console.warn('[ad-studio:b3] image_failed_no_retry', { runId, index: variant.index, jobId: fresh.id })
      }
      continue
    }
    const active = await svc.store.countActive(workspaceId, run.userId)
    if (active >= svc.concurrencyLimit) { console.info('[ad-studio:b3] image_wait_capacity', { runId, active }); break }
    const jobId = idFor('stjob_adv_', runId + ':' + variant.id)
    const claimed = await db.adStudioImageVariant.updateMany({
      where: { id: variant.id, runId, status: 'planned', studioJobId: null }, data: { studioJobId: jobId },
    })
    if (!claimed.count) continue
    const stillActive = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId, status: 'generating' }, select: { id: true } })
    if (!stillActive) break
    console.info('[ad-studio:b3] image_submit_begin', { runId, index: variant.index, jobId, modelId: variant.modelId })
    try {
      const conceptPrompt = photoAds ? plan?.photoAds?.concepts?.[variant.index]?.prompt : undefined
      if (photoAds && !conceptPrompt) throw new Error('Photo-ad concept prompt is missing')
      const orderedRefs = photoAds
        ? [...new Set([input.imageAssetIds[0], input.logoAssetId, ...input.imageAssetIds.slice(1)].filter((value): value is string => Boolean(value)))].slice(0, 8)
        : []
      await createStudioJob(svc, { workspaceId, userId: run.userId, jobId,
        body: {
          modelId: variant.modelId,
          mode: 'text_to_image',
          prompt: conceptPrompt || adVariantPrompt(input, variant.index),
          aspect: input.aspect,
          ...(photoAds ? { resolution: '2K', referenceAssetIds: orderedRefs }
            : input.imageAssetIds[0] ? { referenceAssetId: input.imageAssetIds[0] } : {}),
        } })
      console.info('[ad-studio:b3] image_submit_complete', { runId, index: variant.index, jobId })
    } catch (err) {
      const recorded = await svc.store.getJob(workspaceId, jobId)
      if (!recorded && err instanceof Error && err.message.includes('Too many jobs')) {
        await db.adStudioImageVariant.updateMany({ where: { id: variant.id, runId, status: 'planned', studioJobId: jobId },
          data: { studioJobId: null } })
        console.info('[ad-studio:b3] image_capacity_race', { runId, index: variant.index })
        break
      }
      failed = true
      await db.adStudioImageVariant.updateMany({ where: { id: variant.id, runId, status: 'planned' }, data: { status: 'failed' } })
      console.warn('[ad-studio:b3] image_submit_failed_no_retry', { runId, index: variant.index, jobId, type: err instanceof Error ? err.name : typeof err })
      break
    }
  }
  if (failed) {
    await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, status: 'generating' },
      data: { status: 'failed', errorCode: 'KIE_ERROR', errorMessage: 'An image-ad variant failed. No automatic retry was started.' } })
    return 'failed'
  }
  const remaining = await db.adStudioImageVariant.count({ where: { runId, status: { not: 'ready' } } })
  console.info('[ad-studio:b3] image_variants_tick_complete', { runId, remaining })
  return remaining === 0 ? 'ready' : 'running'
}


/** Gemini QC is advisory only. It never resets or re-submits a paid still job. */
export async function reviewReadyPhotoAds(workspaceId: string, runId: string, svc: StudioService = createDefaultStudioService()): Promise<void> {
  const db = getPrisma()
  const run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  if (!run || run.mode !== 'image_to_ad') return
  const input = run.input as unknown as AdProductInput
  const plan = run.plan as unknown as AdPlan | null
  if (!plan?.photoAds?.concepts?.length) return
  const qcByIndex = { ...(plan.photoAds.qcByIndex ?? {}) }
  const variants = await db.adStudioImageVariant.findMany({ where: { runId, status: 'ready' }, orderBy: { index: 'asc' } })
  let changed = false
  for (const variant of variants) {
    if (qcByIndex[String(variant.index)] || !variant.studioJobId) continue
    try {
      const job = await svc.store.getJob(workspaceId, variant.studioJobId)
      if (!job?.outputStorageKey || job.outputKind !== 'image') continue
      const imagePart = await inlineStoredImage(job.outputStorageKey, job.outputStorageDriver)
      qcByIndex[String(variant.index)] = await reviewPhotoAdForQc({
        imagePart,
        originalPrompt: plan.photoAds.concepts[variant.index]!.prompt,
        brief: input,
      })
      changed = true
    } catch (err) {
      console.warn('[ad-studio:r5] still_qc_failed_flag_only', {
        runId, index: variant.index, type: err instanceof Error ? err.name : typeof err,
      })
    }
  }
  if (!changed) return
  const nextPlan: AdPlan = { ...plan, photoAds: { ...plan.photoAds, qcByIndex } }
  await db.adStudioRun.updateMany({ where: { id: runId, workspaceId }, data: { plan: nextPlan as never } })
  console.info('[ad-studio:r5] still_qc_persisted', { runId, reviewed: Object.keys(qcByIndex).length })
}
