import 'server-only'
import { createHash } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { clipWordsKey, getClipStorage, uploadSourceKey, storageDriverName } from '@/lib/storage'
import { defaultClipSettings } from '@/lib/clips/settings'
import { buildAdTimelineEdits, type AdTimelineScene } from '@/lib/ad-studio/timeline'
import { registerProjectMedia } from '@/lib/server/clips/project-media'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import type { AdPlan, AdProductInput } from '@/lib/ad-studio/types'
import { adVoiceWordsKey } from '@/lib/ad-studio/voice'
import { attachStockAudioToProject } from '@/lib/server/ai/stock-audio'
import { enqueueRenderClip } from '@/lib/server/clips/renders'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { createDefaultStudioService } from '@/lib/studio/runtime'
import { getStudioJobForOutput } from '@/lib/studio/jobs'

const stableId = (prefix: string, key: string) =>
  prefix + createHash('sha256').update(key).digest('hex').slice(0, 32)

type AdVoiceWord = { w: string; s: number; e: number; i: number; spk: number }

async function readAdVoiceWords(workspaceId: string, runId: string): Promise<AdVoiceWord[]> {
  console.info('[ad-studio:b3] voice_words_read_begin', { runId })
  try {
    const raw = await getClipStorage(storageDriverName()).getJson<unknown>(adVoiceWordsKey(workspaceId, runId))
    if (!Array.isArray(raw)) return []
    const words: AdVoiceWord[] = []
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue
      const word = row as Partial<AdVoiceWord>
      const s = Number(word.s)
      const e = Number(word.e)
      const i = Number(word.i)
      const spk = Number(word.spk)
      if (typeof word.w !== 'string' || !Number.isFinite(s) || !Number.isFinite(e)
        || !Number.isInteger(i) || !Number.isInteger(spk) || e <= s) continue
      words.push({ w: word.w, s, e, i, spk })
    }
    console.info('[ad-studio:b3] voice_words_read_complete', { runId, wordCount: words.length })
    return words
  } catch (err) {
    console.info('[ad-studio:b3] voice_words_unavailable', {
      runId, type: err instanceof Error ? err.name : typeof err,
    })
    return []
  }
}

async function writeAdClipWords(
  workspaceId: string,
  projectId: string,
  clipId: string,
  words: AdVoiceWord[],
): Promise<void> {
  const key = clipWordsKey(workspaceId, projectId, clipId)
  console.info('[ad-studio:b3] clip_words_write_begin', { projectId, clipId, wordCount: words.length })
  await getClipStorage(storageDriverName()).putJson(key, words)
  console.info('[ad-studio:b3] clip_words_write_complete', { projectId, clipId, wordCount: words.length })
}

/** No PROCESS_PROJECT: create the real DB project first, then the B3 canvas job. */
export async function ensureAdDestinationProject(workspaceId: string, runId: string): Promise<'queued' | 'ready' | 'failed'> {
  const db = getPrisma()
  let run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  if (!run || run.status !== 'stitching') return 'queued'
  console.info('[ad-studio:b3] destination_begin', { runId, projectId: run.projectId })
  const input = run.input as unknown as AdProductInput
  const durationMs = input.durationSec * 1000
  if (!run.projectId) {
    const projectId = createId('proj')
    const uploadId = createId('upl')
    const settings = defaultClipSettings({
      aspectRatio: input.aspect, rangeStartMs: 0, rangeEndMs: durationMs,
      byo: true, fullVideo: true, blank: true,
      captions: { enabled: input.voiceoverEnabled !== false, presetId: 'bold_pop', language: 'en' },
    })
    await db.$transaction(async tx => {
      const claimed = await tx.adStudioRun.updateMany({
        where: { id: runId, workspaceId, status: 'stitching', projectId: null },
        data: { projectId },
      })
      if (!claimed.count) return
      await tx.clipUpload.create({
        data: { id: uploadId, workspaceId, key: uploadSourceKey(workspaceId, uploadId, 'mp4'),
          filename: 'Ad Studio canvas.mp4', bytes: BigInt(0), mime: 'video/mp4',
          status: 'PENDING', storageDriver: storageDriverName(), kind: 'source' },
      })
      await tx.clipProject.create({
        data: { id: projectId, workspaceId, createdById: run!.userId,
          title: `${input.name} commercial`.slice(0, 120), uploadId, sourceKind: 'ad_studio',
          settings: toPrismaJson(settings), rangeStartMs: 0, rangeEndMs: durationMs,
          status: 'QUEUED', stage: 'ad_studio_canvas', progress: 0 },
      })
      await tx.clipJob.create({
        data: { id: createId('job'), projectId, type: 'AD_STUDIO_RUN', status: 'QUEUED',
          maxAttempts: 1, payload: { runId, durationMs } },
      })
      console.info('[ad-studio:b3] destination_project_created', { runId, projectId, uploadId, durationMs })
    })
    run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  }
  if (!run?.projectId) return 'queued'
  const project = await db.clipProject.findFirst({
    where: { id: run.projectId, workspaceId },
    select: { status: true, id: true },
  })
  if (project?.status === 'READY') return 'ready'
  const jobFailed = await db.clipJob.findFirst({
    where: { projectId: run.projectId, type: 'AD_STUDIO_RUN', status: 'FAILED' },
    select: { id: true },
  })
  if (jobFailed || project?.status === 'FAILED') {
    await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, status: 'stitching' },
      data: { status: 'failed', errorCode: 'STORAGE_ERROR', errorMessage: 'Ad Studio could not prepare its editor canvas.' } })
    console.warn('[ad-studio:b3] destination_failed', { runId, projectId: run.projectId })
    return 'failed'
  }
  console.info('[ad-studio:b3] destination_wait_canvas', { runId, projectId: run.projectId, status: project?.status })
  return 'queued'
}

async function ensureMediaUpload(input: {
  workspaceId: string; projectId: string; uploadId: string; key: string; filename: string;
  mime: string; durationMs?: number | null; width?: number | null; height?: number | null;
  driver?: string | null;
}): Promise<void> {
  const db = getPrisma()
  console.info('[ad-studio:b3] media_register_begin', {
    projectId: input.projectId, uploadId: input.uploadId, mime: input.mime,
  })
  await db.clipUpload.upsert({
    where: { id: input.uploadId },
    create: { id: input.uploadId, workspaceId: input.workspaceId, key: input.key,
      filename: input.filename, mime: input.mime, durationMs: input.durationMs ?? null,
      width: input.width ?? null, height: input.height ?? null, bytes: BigInt(1),
      status: 'COMPLETE', storageDriver: input.driver || storageDriverName(), kind: 'media' },
    update: {},
  })
  await registerProjectMedia(input.workspaceId, input.projectId, {
    uploadId: input.uploadId, label: input.filename, durationMs: input.durationMs ?? undefined,
    width: input.width ?? undefined, height: input.height ?? undefined,
  })
  console.info('[ad-studio:b3] media_register_complete', { projectId: input.projectId, uploadId: input.uploadId })
}

/** Durable editor clip with existing B-roll, source segments and audio-clip contracts. */
export async function ensureAdEditorClip(workspaceId: string, runId: string): Promise<string | null> {
  const db = getPrisma()
  const run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  if (!run || run.status !== 'stitching' || !run.projectId) return null
  if (run.clipId) {
    const words = await readAdVoiceWords(workspaceId, runId)
    if (words.length) await writeAdClipWords(workspaceId, run.projectId, run.clipId, words)
    console.info('[ad-studio:b3] editor_clip_reused', {
      runId, projectId: run.projectId, clipId: run.clipId, voiceWords: words.length,
    })
    return run.clipId
  }
  const input = run.input as unknown as AdProductInput
  const plan = run.plan as unknown as AdPlan | null
  const plannedByIndex = new Map((plan?.scenes ?? []).map(scene => [scene.index, scene]))
  const scenes = await db.adStudioScene.findMany({ where: { runId }, orderBy: { index: 'asc' } })
  if (scenes.some(s => s.status !== 'ready' && s.status !== 'skipped')) return null
  const videoJobs = await db.aiStudioJob.findMany({
    where: { workspaceId, id: { in: scenes.map(s => s.studioJobId).filter((v): v is string => Boolean(v)) } },
  })
  const byJob = new Map(videoJobs.map(j => [j.id, j]))
  const projectId = run.projectId
  const timelineScenes: AdTimelineScene[] = []
  for (const scene of scenes) {
    const planned = plannedByIndex.get(scene.index)
    const entry: AdTimelineScene = { id: scene.id, index: scene.index,
      role: (planned?.role ?? scene.role) as AdTimelineScene['role'],
      source: scene.source === 'stock' ? 'stock' : 'generated', status: scene.status,
      startMs: scene.startMs, endMs: scene.endMs, onScreenText: planned?.onScreenText,
      stockAssetId: scene.stockAssetId,
      sourceInMs: scene.sourceInMs, trimInMs: scene.trimInMs,
    }
    if (scene.status === 'ready' && scene.source === 'generated') {
      const job = scene.studioJobId ? byJob.get(scene.studioJobId) : undefined
      if (!job || job.status !== 'done' || !job.outputStorageKey || !job.outputContentType || job.outputKind !== 'video')
        throw new Error('Confirmed Ad Studio shot is missing rendered media')
      const uploadId = stableId('upl_ad_', runId + ':' + scene.id)
      await ensureMediaUpload({ workspaceId, projectId, uploadId, key: job.outputStorageKey,
        filename: `Generated scene ${scene.index + 1}.mp4`, mime: job.outputContentType,
        durationMs: Math.round((job.outputDurationSec ?? job.durationSec ?? scene.durationSec) * 1000),
        width: job.outputWidth, height: job.outputHeight, driver: job.outputStorageDriver })
      entry.uploadId = uploadId
    }
    timelineScenes.push(entry)
    console.info('[ad-studio:b3] timeline_scene_materialized', {
      runId, index: scene.index, source: scene.source, status: scene.status,
      modelId: scene.modelId, providerId: scene.providerId, studioJobId: scene.studioJobId,
    })
  }
  const assetIds = [...new Set([...input.imageAssetIds, ...(input.logoAssetId ? [input.logoAssetId] : [])])]
  const assets = assetIds.length ? await db.aiStudioAsset.findMany({
    where: { id: { in: assetIds }, workspaceId },
  }) : []
  if (assets.length !== assetIds.length) throw new Error('Original product reference media was not found')
  const assetsById = new Map(assets.map(asset => [asset.id, asset]))
  const productPhotos: Array<{ uploadId: string; label: string }> = []
  for (const [index, assetId] of input.imageAssetIds.entries()) {
    const asset = assetsById.get(assetId)
    if (!asset) throw new Error('Original product reference media was not found')
    const uploadId = stableId('upl_adphoto_', runId + ':' + asset.id)
    await ensureMediaUpload({ workspaceId, projectId, uploadId, key: asset.storageKey,
      filename: `Original product ${index + 1}.png`, mime: asset.contentType,
      driver: asset.storageDriver })
    productPhotos.push({ uploadId, label: 'Original product reference' })
  }
  console.info('[ad-studio:b3] product_references_materialized', {
    runId, requested: input.imageAssetIds.length, attached: productPhotos.length,
    primaryReferencePresent: Boolean(productPhotos[0]),
  })
  let voice: { uploadId: string; durationMs: number; wordsAvailable: boolean } | undefined
  let voiceWords: AdVoiceWord[] = []
  if (run.voiceoverStatus === 'ready' && run.voiceoverStorageKey && run.voiceoverDurationMs) {
    const uploadId = stableId('upl_advoice_', runId)
    await ensureMediaUpload({ workspaceId, projectId, uploadId, key: run.voiceoverStorageKey,
      filename: 'Ad voiceover.mp3', mime: 'audio/mpeg', durationMs: run.voiceoverDurationMs })
    voiceWords = await readAdVoiceWords(workspaceId, runId)
    voice = { uploadId, durationMs: run.voiceoverDurationMs, wordsAvailable: voiceWords.length > 0 }
  }

  const plannedDurationMs = input.durationSec * 1000
  // The user's selected ad length is a hard editorial target. A short narration
  // holds the CTA/last shot; it never shrinks the clip.
  const durationMs = plannedDurationMs
  console.info('[ad-studio:b3] timeline_duration_resolved', {
    runId,
    plannedDurationMs,
    voiceDurationMs: voice?.durationMs ?? null,
    durationMs,
    ctaHoldMs: voice ? Math.max(0, plannedDurationMs - voice.durationMs) : plannedDurationMs,
  })

  let music: { uploadId: string } | undefined
  try {
    console.info('[ad-studio:b3] music_attach_begin', { runId, stockId: 'cc0-menu-loop' })
    music = await attachStockAudioToProject(workspaceId, projectId, 'cc0-menu-loop')
    console.info('[ad-studio:b3] music_attach_complete', { runId, attached: true })
  } catch (err) {
    console.info('[ad-studio:b3] music_attach_skipped', {
      runId, type: err instanceof Error ? err.name : typeof err,
    })
  }

  const ctaScene = [...timelineScenes].reverse().find(scene => scene.role === 'cta')
  const logoAsset = input.logoAssetId ? assetsById.get(input.logoAssetId) : undefined
  const logo = logoAsset && ctaScene
    ? {
        storageKey: logoAsset.storageKey,
        startMs: Math.max(0, Math.min(durationMs - 300, ctaScene.startMs)),
        endMs: durationMs,
      }
    : undefined

  const edits = buildAdTimelineEdits({
    durationMs, aspect: input.aspect, productName: input.name,
    scenes: timelineScenes, productPhotos, voice, music, logo,
  })
  const clipId = stableId('clip_ad_', runId)
  console.info('[ad-studio:b3] editor_clip_create_begin', { runId, projectId, clipId, scenes: scenes.length })
  await db.clip.upsert({
    where: { id: clipId },
    create: { id: clipId, workspaceId, projectId, title: `${input.name} commercial`.slice(0, 120),
      reason: 'ad_studio', startMs: 0, endMs: durationMs,
      storageDriver: storageDriverName(), edits: toPrismaJson(edits),
      aiMeta: toPrismaJson({ adStudioRunId: runId, originalProductImageCount: productPhotos.length }) },
    update: {},
  })
  await writeAdClipWords(workspaceId, projectId, clipId, voiceWords)
  await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, status: 'stitching', clipId: null },
    data: { clipId } })
  console.info('[ad-studio:b3] editor_clip_created', { runId, projectId, clipId })
  return clipId
}

/** One enqueue only, followed by status polling. Never silently auto-retry a failed render. */
export async function advanceAdRender(workspaceId: string, runId: string): Promise<void> {
  const db = getPrisma()
  const run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  if (!run || run.status !== 'stitching' || !run.clipId) return
  if (run.renderId) {
    const render = await db.clipRender.findFirst({ where: { id: run.renderId, workspaceId } })
    console.info('[ad-studio:b3] render_polled', { runId, renderId: run.renderId, status: render?.status })
    if (render?.status === 'READY' && render.outputKey) {
      await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, status: 'stitching' },
        data: { status: 'done', renderStatus: 'ready', completedAt: new Date(), errorCode: null, errorMessage: null } })
      console.info('[ad-studio:b3] run_done', { runId, projectId: run.projectId, clipId: run.clipId, renderId: run.renderId })
    } else if (render?.status === 'FAILED') {
      await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, status: 'stitching' },
        data: { status: 'failed', renderStatus: 'failed', errorCode: 'RENDER_ERROR',
          errorMessage: 'Ad Studio could not render this commercial.' } })
      console.warn('[ad-studio:b3] render_failed_no_auto_retry', { runId, renderId: run.renderId })
    }
    return
  }
  if (run.renderStatus) return
  const claimed = await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, status: 'stitching', renderStatus: null },
    data: { renderStatus: 'enqueueing' } })
  if (!claimed.count) return
  try {
    const clip = await db.clip.findFirst({ where: { id: run.clipId!, workspaceId, projectId: run.projectId! } })
    if (!clip) throw new Error('Destination clip not found')
    console.info('[ad-studio:b3] render_enqueue_begin', { runId, projectId: run.projectId, clipId: run.clipId })
    const result = await enqueueRenderClip(workspaceId, clip.id, {
      resolution: '720p', aspect: (run.input as unknown as AdProductInput).aspect,
      watermark: false, edits: clip.edits as unknown as ClipEditsV2,
      clipStartMs: 0, clipEndMs: clip.endMs, previewKey: clip.previewKey,
      title: clip.title,
    })
    await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, status: 'stitching', renderStatus: 'enqueueing' },
      data: { renderId: result.render.id, renderJobId: 'jobId' in result ? result.jobId ?? null : null, renderStatus: 'queued' } })
    console.info('[ad-studio:b3] render_queued', { runId, renderId: result.render.id,
      renderJobId: 'jobId' in result ? result.jobId : undefined })
  } catch (err) {
    await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, status: 'stitching', renderStatus: 'enqueueing' },
      data: { status: 'failed', renderStatus: 'failed', errorCode: 'RENDER_ERROR',
        errorMessage: 'Ad Studio could not enqueue the commercial render.' } })
    console.warn('[ad-studio:b3] render_enqueue_failed', { runId, type: err instanceof Error ? err.name : typeof err })
  }
}


/**
 * Round 5 direct commercial: the single native-audio KIE output is itself the finished MP4.
 * It is registered as project source, editor clip, and READY render without a second render worker pass.
 */
export async function materializeDirectAdCommercial(workspaceId: string, runId: string): Promise<boolean> {
  const db = getPrisma()
  const run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  if (!run || run.mode !== 'image_ad_to_commercial' || run.status !== 'generating') return false
  const input = run.input as unknown as AdProductInput
  const scene = await db.adStudioScene.findFirst({ where: { runId, status: 'ready' }, orderBy: { index: 'asc' } })
  if (!scene?.studioJobId) return false
  const svc = createDefaultStudioService()
  const job = await getStudioJobForOutput(svc, workspaceId, scene.studioJobId)
  if (job.outputKind !== 'video' || !job.outputStorageKey || !job.outputContentType) return false

  const durationMs = 15_000
  const uploadId = stableId('upl_ad_direct_', runId)
  const projectId = stableId('proj_ad_direct_', runId)
  const clipId = stableId('clip_ad_direct_', runId)
  const renderId = stableId('rnd_ad_direct_', runId)
  const settings = defaultClipSettings({
    aspectRatio: input.aspect,
    rangeStartMs: 0,
    rangeEndMs: durationMs,
    byo: true,
    fullVideo: true,
    captions: { enabled: false, presetId: 'bold_pop', language: 'en' },
  })
  const edits = {
    ...defaultEdits({ clipStartMs: 0, clipEndMs: durationMs, trimMinMs: 0, trimMaxMs: durationMs }),
    aspectRatio: input.aspect,
    captions: { enabled: false },
    audio: { music: null, sfx: [] },
  } satisfies ClipEditsV2

  console.info('[ad-studio:r5] direct_materialize_begin', {
    runId, jobId: job.id, modelId: job.modelId, aspect: input.aspect,
  })
  await db.$transaction(async (tx) => {
    await tx.clipUpload.upsert({
      where: { id: uploadId },
      create: {
        id: uploadId, workspaceId, key: job.outputStorageKey!, filename: (input.name + ' 15s commercial.mp4').slice(0, 180),
        bytes: BigInt(0), mime: job.outputContentType!, durationMs,
        width: job.outputWidth, height: job.outputHeight, status: 'COMPLETE',
        storageDriver: job.outputStorageDriver, kind: 'source',
      },
      update: {},
    })
    await tx.clipProject.upsert({
      where: { id: projectId },
      create: {
        id: projectId, workspaceId, createdById: run.userId, title: (input.name + ' commercial').slice(0,120),
        uploadId, sourceKind: 'ad_studio_direct', settings: toPrismaJson(settings),
        rangeStartMs: 0, rangeEndMs: durationMs, status: 'READY', stage: 'ready', progress: 100,
      },
      update: {},
    })
    await tx.clip.upsert({
      where: { id: clipId },
      create: {
        id: clipId, workspaceId, projectId, title: (input.name + ' 15s commercial').slice(0,120),
        reason: 'ad_studio_direct', startMs: 0, endMs: durationMs,
        segmentKey: job.outputStorageKey, sourceSegKey: job.outputStorageKey,
        sourceSegStartMs: 0, sourceSegEndMs: durationMs, previewKey: job.outputStorageKey,
        storageDriver: job.outputStorageDriver, edits: toPrismaJson(edits),
        aiMeta: toPrismaJson({ adStudioRunId: runId, directCommercial: true, modelId: job.modelId, nativeAudio: true }),
      },
      update: {},
    })
    await tx.clipRender.upsert({
      where: { id: renderId },
      create: {
        id: renderId, clipId, workspaceId, status: 'READY', outputKey: job.outputStorageKey,
        format: 'mp4', resolution: job.resolution ?? '720p', aspectRatio: input.aspect,
        watermark: false, filename: (input.name + '-15s-commercial.mp4').slice(0,180),
      },
      update: {},
    })
    await tx.adStudioRun.updateMany({
      where: { id: runId, workspaceId, status: 'generating' },
      data: {
        status: 'done', projectId, clipId, renderId, renderStatus: 'ready',
        voiceoverStatus: 'skipped', completedAt: new Date(), errorCode: null, errorMessage: null,
      },
    })
  })
  console.info('[ad-studio:r5] direct_materialize_complete', { runId, projectId, clipId, renderId })
  return true
}
