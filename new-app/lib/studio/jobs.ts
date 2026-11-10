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

async function resolveAssetUrl(
  svc: StudioService,
  workspaceId: string,
  assetId: string | null,
): Promise<string | undefined> {
  if (!assetId) return undefined
  const asset = await svc.store.getAsset(workspaceId, assetId)
  if (!asset) throw new StudioError('INVALID_PARAMS', 'Asset not found')
  try {
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
  },
): Promise<StudioJob> {
  const resolved = resolveStudioCreateInput(input.body)
  if (resolved.projectId) {
    const ok = await svc.store.projectExists(input.workspaceId, resolved.projectId)
    if (!ok) throw new StudioError('PROJECT_NOT_FOUND', 'Project not found')
  }

  const active = await svc.store.countActive(input.workspaceId, input.userId)
  if (active >= svc.concurrencyLimit) {
    throw new StudioError('CONCURRENCY_LIMIT', 'Too many jobs already in progress')
  }

  const now = svc.now()
  const id = createId('stjob')
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
    creditEstimate: resolved.model.creditEstimate,
    provider: 'kie',
    providerTaskId: null,
    providerApi: resolved.model.providerApi,
    referenceAssetId: resolved.referenceAssetId,
    startFrameAssetId: resolved.startFrameAssetId,
    endFrameAssetId: resolved.endFrameAssetId,
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
  await svc.store.createJob(queued)

  let taskId: string
  try {
    const urls = {
      referenceUrl: await resolveAssetUrl(svc, input.workspaceId, resolved.referenceAssetId),
      startFrameUrl: await resolveAssetUrl(svc, input.workspaceId, resolved.startFrameAssetId),
      endFrameUrl: await resolveAssetUrl(svc, input.workspaceId, resolved.endFrameAssetId),
    }
    const req = buildKieCreateRequest(resolved, urls)
    // One attempt only — no automatic paid retries.
    const created = await svc.kie.createTask(req)
    taskId = created.taskId
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
