import { createId } from '../supabase/id'
import { StudioError } from './errors'
import { buildKieCreateRequest, contentTypeForKind, getStudioModel, outputKindForModel, resolveStudioCreateInput } from './models'
import { serializeStudioJob } from './serialize'
import type { StudioKieClient } from './kie-client'
import type { StudioStore } from './store'
import type { StudioAssetRecord, StudioCreateJobInput, StudioJob, StudioJobRecord, StudioJobStatus } from './types'

export const DEFAULT_STUDIO_CONCURRENCY = 3
const DEFAULT_LIST_LIMIT = 24
const MAX_LIST_LIMIT = 50

export type StudioStorage = {
  putBytes: (objectKey: string, body: Buffer, contentType: string) => Promise<void>
  createSignedDownloadUrl: (objectKey: string, expiresInSec: number) => Promise<string>
  driverName: () => string
}

export type StudioService = {
  store: StudioStore
  kie: StudioKieClient
  storage: StudioStorage
  concurrencyLimit: number
  now: () => Date
}

export function studioConcurrencyLimit(): number {
  const raw = Number(process.env.STUDIO_MAX_CONCURRENT_JOBS)
  if (Number.isFinite(raw) && raw >= 1 && raw <= 20) return Math.floor(raw)
  return DEFAULT_STUDIO_CONCURRENCY
}

function extForContentType(contentType: string, kind: 'video' | 'image'): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('mp4')) return 'mp4'
  if (contentType.includes('webm')) return 'webm'
  return kind === 'video' ? 'mp4' : 'png'
}

export const SOURCE_VIDEO_KIND = 'source_video:'

export function parseSourceVideoKind(kind: string): { clipId: string; startMs: number; endMs: number } | null {
  if (!kind.startsWith(SOURCE_VIDEO_KIND)) return null
  const parts = kind.slice(SOURCE_VIDEO_KIND.length).split(':')
  if (parts.length !== 3) return null
  const [clipId, startRaw, endRaw] = parts
  const startMs = Number(startRaw)
  const endMs = Number(endRaw)
  if (!clipId || !Number.isInteger(startMs) || !Number.isInteger(endMs) || endMs <= startMs) return null
  return { clipId, startMs, endMs }
}

async function resolveAssetUrl(
  svc: StudioService,
  workspaceId: string,
  assetId: string | null,
): Promise<string | undefined> {
  if (!assetId) return undefined
  const asset = await svc.store.getAsset(workspaceId, assetId)
  if (!asset) throw new StudioError('INVALID_PARAMS', 'Asset not found')
  try {
    const sourceInfo = parseSourceVideoKind(asset.kind)
    if (sourceInfo) {
      const [{ getClipStorageForObjectKey }, { createCachedSignedDownloadUrl }] = await Promise.all([
        import('../storage'),
        import('../storage/signed-download-cache'),
      ])
      const storage = await getClipStorageForObjectKey(asset.storageKey, asset.storageDriver)
      return await createCachedSignedDownloadUrl(storage, asset.storageKey, { versionHint: asset.id }, 3600)
    }
    const signed = await svc.storage.createSignedDownloadUrl(asset.storageKey, 3600)
    // Prefer a KIE-hosted copy so the provider can fetch the file reliably.
    const downloaded = await svc.kie.downloadUrl(signed)
    return await svc.kie.uploadImage(downloaded.bytes, asset.contentType, workspaceId, asset.id)
  } catch (err) {
    if (err instanceof StudioError) throw err
    throw new StudioError('STORAGE_ERROR', 'Failed to prepare reference media')
  }
}

export async function createStudioJob(
  svc: StudioService,
  input: {
    workspaceId: string
    userId: string
    body: StudioCreateJobInput
    /** Internal durable id for Ad Studio. Replays only read the original job; never createTask again. */
    jobId?: string
  },
): Promise<StudioJob> {
  const resolved = resolveStudioCreateInput(input.body)
  let sourceVideoInfo: { clipId: string; startMs: number; endMs: number } | null = null
  if (resolved.sourceVideoAssetId) {
    const sourceAsset = await svc.store.getAsset(input.workspaceId, resolved.sourceVideoAssetId)
    sourceVideoInfo = sourceAsset ? parseSourceVideoKind(sourceAsset.kind) : null
    if (!sourceAsset || !sourceVideoInfo) {
      throw new StudioError('INVALID_PARAMS', 'Source video asset is missing or invalid')
    }
    const sourceDurationSec = (sourceVideoInfo.endMs - sourceVideoInfo.startMs) / 1000
    if (!Number.isInteger(sourceDurationSec) || sourceDurationSec !== resolved.durationSec) {
      throw new StudioError('INVALID_PARAMS', 'Source video asset duration does not match the requested range')
    }
    if (!resolved.projectId || !(await svc.store.clipInProject(input.workspaceId, resolved.projectId, sourceVideoInfo.clipId))) {
      throw new StudioError('INVALID_PARAMS', 'Source video clip was not found in this project')
    }
  }
  if (input.jobId) {
    const existing = await svc.store.getJob(input.workspaceId, input.jobId)
    if (existing) {
      if (existing.userId !== input.userId || existing.modelId !== resolved.model.id ||
          existing.mode !== resolved.mode || existing.prompt !== resolved.prompt ||
          existing.durationSec !== resolved.durationSec ||
          existing.referenceAssetId !== resolved.referenceAssetId ||
          existing.startFrameAssetId !== resolved.startFrameAssetId ||
          existing.sourceVideoAssetId !== resolved.sourceVideoAssetId) {
        throw new StudioError('INVALID_PARAMS', 'A Studio generation id was already used for different input')
      }
      console.info('[ad-studio:b3] child_job_replay', { jobId: existing.id, status: existing.status })
      return serializeStudioJob(existing)
    }
  }
  if (resolved.projectId) {
    const ok = await svc.store.projectExists(input.workspaceId, resolved.projectId)
    if (!ok) throw new StudioError('PROJECT_NOT_FOUND', 'Project not found')
  }

  const active = await svc.store.countActive(input.workspaceId, input.userId)
  if (active >= svc.concurrencyLimit) {
    throw new StudioError('CONCURRENCY_LIMIT', 'Too many jobs already in progress')
  }

  const now = svc.now()
  const id = input.jobId ?? createId('stjob')
  const queued: StudioJobRecord = {
    id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    projectId: resolved.projectId,
    status: 'queued',
    modelId: resolved.model.id,
    mode: resolved.mode,
    prompt: resolved.prompt,
    aspect: resolved.aspect,
    durationSec: resolved.durationSec,
    resolution: resolved.resolution,
    creditEstimate: resolved.creditEstimate,
    provider: 'kie',
    providerTaskId: null,
    providerApi: resolved.model.providerApi,
    referenceAssetId: resolved.referenceAssetId,
    startFrameAssetId: resolved.startFrameAssetId,
    endFrameAssetId: resolved.endFrameAssetId,
    sourceVideoAssetId: resolved.sourceVideoAssetId,
    outputStorageKey: null,
    outputStorageDriver: null,
    outputContentType: null,
    outputWidth: null,
    outputHeight: null,
    outputDurationSec: null,
    outputKind: null,
    outputUploadId: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  }
  try {
    await svc.store.createJob(queued)
  } catch (err) {
    // If a concurrent caller won the unique-id insert, it owns the only paid createTask.
    if (input.jobId) {
      const existing = await svc.store.getJob(input.workspaceId, id)
      if (existing) {
        if (existing.userId !== input.userId || existing.modelId !== resolved.model.id ||
            existing.mode !== resolved.mode || existing.prompt !== resolved.prompt ||
            existing.durationSec !== resolved.durationSec ||
            existing.referenceAssetId !== resolved.referenceAssetId ||
            existing.startFrameAssetId !== resolved.startFrameAssetId ||
            existing.sourceVideoAssetId !== resolved.sourceVideoAssetId) {
          throw new StudioError('INVALID_PARAMS', 'A Studio generation id was already used for different input')
        }
        console.info('[ad-studio:b3] child_job_concurrent_replay', { jobId: id, status: existing.status })
        return serializeStudioJob(existing)
      }
    }
    throw err
  }

  let taskId: string
  try {
    const referenceUrls: string[] = []
    for (const assetId of resolved.referenceAssetIds) {
      const url = await resolveAssetUrl(svc, input.workspaceId, assetId)
      if (url) referenceUrls.push(url)
    }
    const urls = {
      sourceVideoUrl: await resolveAssetUrl(svc, input.workspaceId, resolved.sourceVideoAssetId),
      referenceUrl: referenceUrls[0] ?? await resolveAssetUrl(svc, input.workspaceId, resolved.referenceAssetId),
      referenceUrls,
      startFrameUrl: await resolveAssetUrl(svc, input.workspaceId, resolved.startFrameAssetId),
      endFrameUrl: await resolveAssetUrl(svc, input.workspaceId, resolved.endFrameAssetId),
    }
    const req = buildKieCreateRequest(resolved, urls)
    // One attempt only — no automatic paid retries.
    const created = await svc.kie.createTask(req)
    taskId = created.taskId
    if (resolved.mode === 'source_video_edit') {
      console.info('[editor:generate-mode] job-created', { jobId: id, modelId: resolved.model.id, durationSec: resolved.durationSec, credits: resolved.creditEstimate })
    }
  } catch (err) {
    const failed = await svc.store.updateJob(id, {
      status: 'failed',
      errorCode: err instanceof StudioError ? err.code : 'KIE_ERROR',
      errorMessage: err instanceof Error ? err.message : 'KIE createTask failed',
      completedAt: svc.now(),
    })
    if (err instanceof StudioError && err.code !== 'KIE_ERROR') {
      // Surface validation/storage failures with their own codes; the failed row is already stored.
      throw err
    }
    throw new StudioError('KIE_ERROR', failed.errorMessage || 'KIE createTask failed')
  }

  const running = await svc.store.updateJob(id, {
    status: 'running',
    providerTaskId: taskId,
    providerApi: resolved.model.providerApi,
    startedAt: svc.now(),
  })
  return serializeStudioJob(running)
}

export async function refreshStudioJob(svc: StudioService, job: StudioJobRecord): Promise<StudioJobRecord> {
  if (job.status === 'done' || job.status === 'failed') return job
  if (!job.providerTaskId || !job.providerApi) return job

  let snapshot
  try {
    snapshot = await svc.kie.fetchTask(job.providerTaskId, job.providerApi)
  } catch (err) {
    // Poll errors are transient; leave the job running so the next GET can try again
    // (this is not a paid retry of createTask).
    void err
    return job
  }

  if (snapshot.state === 'running') return job

  if (snapshot.state === 'fail') {
    return svc.store.updateJob(job.id, {
      status: 'failed',
      errorCode: 'KIE_ERROR',
      errorMessage: snapshot.failMsg || 'KIE task failed',
      completedAt: svc.now(),
    })
  }

  if (!snapshot.resultUrl) {
    return svc.store.updateJob(job.id, {
      status: 'failed',
      errorCode: 'KIE_ERROR',
      errorMessage: 'KIE success response was missing a result URL',
      completedAt: svc.now(),
    })
  }

  const model = getStudioModel(job.modelId)
  const kind = outputKindForModel(model?.kind || (job.mode === 'text_to_image' ? 'image' : 'video'))
  let downloaded
  try {
    downloaded = await svc.kie.downloadUrl(snapshot.resultUrl)
  } catch {
    return svc.store.updateJob(job.id, {
      status: 'failed',
      errorCode: 'STORAGE_ERROR',
      errorMessage: 'Failed to copy generated media into storage',
      completedAt: svc.now(),
    })
  }

  const contentType = contentTypeForKind(kind, snapshot.contentTypeHint || downloaded.contentType)
  const ext = extForContentType(contentType, kind)
  const storageKey = `ws/${job.workspaceId}/studio/${job.id}/output.${ext}`
  try {
    await svc.storage.putBytes(storageKey, downloaded.bytes, contentType)
  } catch {
    return svc.store.updateJob(job.id, {
      status: 'failed',
      errorCode: 'STORAGE_ERROR',
      errorMessage: 'Failed to store generated media',
      completedAt: svc.now(),
    })
  }

  return svc.store.updateJob(job.id, {
    status: 'done',
    outputStorageKey: storageKey,
    outputStorageDriver: svc.storage.driverName(),
    outputContentType: contentType,
    outputKind: kind,
    outputDurationSec: kind === 'video' ? job.durationSec : null,
    errorCode: null,
    errorMessage: null,
    completedAt: svc.now(),
  })
}

export async function getStudioJob(
  svc: StudioService,
  workspaceId: string,
  id: string,
): Promise<StudioJob> {
  const job = await svc.store.getJob(workspaceId, id)
  if (!job) throw new StudioError('JOB_NOT_FOUND', 'Job not found')
  const fresh = await refreshStudioJob(svc, job)
  return serializeStudioJob(fresh)
}

export async function listStudioJobs(
  svc: StudioService,
  workspaceId: string,
  query: { limit?: number; cursor?: string | null; status?: string; modelId?: string; projectId?: string },
): Promise<{ jobs: StudioJob[]; nextCursor: string | null }> {
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIST_LIMIT))
  const status = query.status as StudioJobStatus | undefined
  if (status && !['queued', 'running', 'done', 'failed'].includes(status)) {
    throw new StudioError('INVALID_PARAMS', 'Invalid status filter')
  }
  if (query.modelId && !getStudioModel(query.modelId)) {
    throw new StudioError('UNKNOWN_MODEL', 'Unknown or disabled model')
  }
  const listed = await svc.store.listJobs(workspaceId, {
    limit,
    cursor: query.cursor,
    status,
    modelId: query.modelId,
    projectId: query.projectId,
  })
  const refreshed: StudioJobRecord[] = []
  let polls = 0
  for (const job of listed.jobs) {
    if ((job.status === 'queued' || job.status === 'running') && job.providerTaskId && polls < 5) {
      polls += 1
      refreshed.push(await refreshStudioJob(svc, job))
    } else {
      refreshed.push(job)
    }
  }
  return { jobs: refreshed.map(serializeStudioJob), nextCursor: listed.nextCursor }
}

export async function getStudioJobForOutput(
  svc: StudioService,
  workspaceId: string,
  id: string,
): Promise<StudioJobRecord> {
  const job = await svc.store.getJob(workspaceId, id)
  if (!job) throw new StudioError('JOB_NOT_FOUND', 'Job not found')
  const fresh = await refreshStudioJob(svc, job)
  if (fresh.status !== 'done' || !fresh.outputStorageKey) {
    throw new StudioError('JOB_NOT_READY', 'Job output is not ready')
  }
  return fresh
}

export function studioAssetKey(workspaceId: string, assetId: string, ext: string): string {
  return `ws/${workspaceId}/studio/assets/${assetId}.${ext}`
}

export async function createStudioClipSourceAsset(
  svc: StudioService,
  input: { workspaceId: string; userId: string; clipId: string; startMs: number; endMs: number },
): Promise<StudioAssetRecord> {
  const startMs = Math.round(Number(input.startMs))
  const endMs = Math.round(Number(input.endMs))
  if (!input.clipId || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new StudioError('INVALID_PARAMS', 'A valid clip range is required')
  }
  const [{ getClipForWorkspace }, { getClipStorageForObjectKey }] = await Promise.all([
    import('../server/clips/clips'),
    import('../storage'),
  ])
  const clip = await getClipForWorkspace(input.workspaceId, input.clipId)
  if (!clip) throw new StudioError('INVALID_PARAMS', 'Clip not found')
  const segStart = clip.sourceSegStartMs == null ? null : Math.round(Number(clip.sourceSegStartMs))
  const segEnd = clip.sourceSegEndMs == null ? null : Math.round(Number(clip.sourceSegEndMs))
  if (!clip.sourceSegKey || segStart == null || segEnd == null) {
    throw new StudioError('INVALID_PARAMS', 'This clip does not have an exact source segment for video editing')
  }
  const sourceSegmentDurationMs = segEnd - segStart
  if (sourceSegmentDurationMs < 2000 || sourceSegmentDurationMs > 10000) {
    throw new StudioError('INVALID_PARAMS', 'Wan 2.7 Video Edit requires the stored source video itself to be 2 to 10 seconds')
  }
  if (startMs !== segStart) {
    throw new StudioError('INVALID_PARAMS', 'The selected range must begin at the available source segment start')
  }
  if (endMs > segEnd) {
    throw new StudioError('INVALID_PARAMS', 'The selected range extends past the available source segment')
  }
  const durationMs = endMs - startMs
  if (durationMs < 2000 || durationMs > 10000 || durationMs % 1000 !== 0) {
    throw new StudioError('INVALID_PARAMS', 'Wan 2.7 Video Edit requires a whole-second source range from 2 to 10 seconds')
  }
  const lowerKey = clip.sourceSegKey.toLowerCase()
  const contentType = lowerKey.endsWith('.mov') ? 'video/quicktime' : lowerKey.endsWith('.mp4') ? 'video/mp4' : null
  if (!contentType) {
    throw new StudioError('INVALID_PARAMS', 'The exact source segment must be MP4 or MOV for Wan 2.7 Video Edit')
  }
  const sourceStorage = await getClipStorageForObjectKey(clip.sourceSegKey, clip.storageDriver ?? null)
  const sourceBytes = await sourceStorage.getObjectSizeBytes(clip.sourceSegKey).catch(() => null)
  if (sourceBytes == null) throw new StudioError('STORAGE_ERROR', 'Could not verify the source video size')
  if (sourceBytes > 100 * 1024 * 1024) {
    throw new StudioError('INVALID_PARAMS', 'Wan 2.7 Video Edit source video must be 100 MB or smaller')
  }
  const id = createId('stast')
  const asset = await svc.store.createAsset({
    id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    storageKey: clip.sourceSegKey,
    storageDriver: clip.storageDriver ?? null,
    contentType,
    bytes: sourceBytes,
    kind: `${SOURCE_VIDEO_KIND}${clip.id}:${startMs}:${endMs}`,
    createdAt: svc.now(),
  })
  console.info('[editor:generate-mode] source-asset-ready', { clipId: clip.id, assetId: id, durationMs })
  return asset
}

export async function createStudioAsset(
  svc: StudioService,
  input: { workspaceId: string; userId: string; bytes: Buffer; contentType: string },
): Promise<StudioAssetRecord> {
  const mime = (input.contentType || '').toLowerCase()
  if (!/^image\/(png|jpe?g|webp)$/.test(mime)) {
    throw new StudioError('INVALID_PARAMS', 'Only PNG, JPEG, or WebP images can be uploaded')
  }
  if (!input.bytes?.length) throw new StudioError('INVALID_PARAMS', 'File is empty')
  if (input.bytes.length > 15 * 1024 * 1024) {
    throw new StudioError('INVALID_PARAMS', 'File is too large')
  }
  const id = createId('stast')
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
  const storageKey = studioAssetKey(input.workspaceId, id, ext)
  try {
    await svc.storage.putBytes(storageKey, input.bytes, input.contentType)
  } catch {
    throw new StudioError('STORAGE_ERROR', 'Failed to store uploaded asset')
  }
  return svc.store.createAsset({
    id,
    workspaceId: input.workspaceId,
    userId: input.userId,
    storageKey,
    storageDriver: svc.storage.driverName(),
    contentType: input.contentType,
    bytes: input.bytes.length,
    kind: 'image',
    createdAt: svc.now(),
  })
}
