/**
 * Dev-only in-memory Studio backend.
 * Used only when the real /api/studio endpoints are missing at runtime
 * and NODE_ENV is not production. Public registry fields only — no provider keys.
 * Option tables are placeholders until GET /api/studio/models is live.
 */
import type {
  CreateStudioJobBody,
  ListStudioJobsQuery,
  ListStudioJobsResponse,
  SendToTimelineBody,
  SendToTimelineResponse,
  StudioAssetSlot,
  StudioJob,
  StudioJobStatus,
  StudioModel,
  StudioModelRegistry,
  StudioAspect,
} from './contract'
import { STUDIO_API_VERSION, STUDIO_PATHS } from './contract'
import { StudioClientError, mapStudioHttpError } from './errors'
import { parseStudioJob } from './parse'

function err(code: string, message: string, status: number): never {
  throw new StudioClientError(mapStudioHttpError({ status, body: { error: message, code } }))
}

/** Dev-only public registry. Launch ids from the contract. */
export const DEV_FALLBACK_MODELS: StudioModel[] = [
  {
    id: 'veo-3.1-lite',
    label: 'Veo 3.1 Lite',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ['9:16', '16:9'],
    durationsSec: [4, 6, 8],
    resolutions: ['720p', '1080p', '4k'],
    creditEstimate: 20,
  },
  {
    id: 'veo-3.1-fast',
    label: 'Veo 3.1 Fast',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ['9:16', '16:9'],
    durationsSec: [4, 6, 8],
    resolutions: ['720p', '1080p', '4k'],
    creditEstimate: 30,
  },
  {
    id: 'veo-3.1-quality',
    label: 'Veo 3.1 Quality',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ['9:16', '16:9'],
    durationsSec: [4, 6, 8],
    resolutions: ['720p', '1080p', '4k'],
    creditEstimate: 50,
  },
  {
    id: 'hailuo-2.3',
    label: 'Hailuo 2.3',
    kind: 'video',
    modes: ['image_to_video'],
    supportsStartEndFrame: false,
    supportsReferenceImage: true,
    aspects: ['9:16', '16:9', '1:1'],
    durationsSec: [6, 10],
    resolutions: ['768P', '1080P'],
    creditEstimate: 12,
  },
  {
    id: 'seedance-2.0-mini',
    label: 'Seedance 2.0 Mini',
    kind: 'video',
    modes: ['text_to_video', 'image_to_video'],
    supportsStartEndFrame: true,
    supportsReferenceImage: true,
    aspects: ['9:16', '16:9', '1:1'],
    durationsSec: [4, 5, 6, 8, 10, 12, 15],
    resolutions: ['480p', '720p'],
    creditEstimate: 8,
  },
  {
    id: 'flux-2-pro',
    label: 'Flux 2 Pro',
    kind: 'image',
    modes: ['text_to_image'],
    supportsStartEndFrame: false,
    supportsReferenceImage: false,
    aspects: ['9:16', '16:9', '1:1'],
    durationsSec: [],
    resolutions: ['1K', '2K'],
    creditEstimate: 5,
  },
  {
    id: 'nano-banana',
    label: 'Nano Banana',
    kind: 'image',
    modes: ['text_to_image'],
    supportsStartEndFrame: false,
    supportsReferenceImage: true,
    aspects: ['9:16', '16:9', '1:1'],
    durationsSec: [],
    resolutions: [],
    creditEstimate: 4,
  },
  {
    id: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    kind: 'image',
    modes: ['text_to_image'],
    supportsStartEndFrame: false,
    supportsReferenceImage: true,
    aspects: ['9:16', '16:9', '1:1'],
    durationsSec: [],
    resolutions: ['1K', '2K', '4K'],
    creditEstimate: 8,
  },
]

export type StudioBackend = {
  listModels(): Promise<StudioModelRegistry>
  uploadAsset(file: Blob, slot: StudioAssetSlot, filename?: string): Promise<{ id: string }>
  createJob(body: CreateStudioJobBody): Promise<StudioJob>
  listJobs(query?: ListStudioJobsQuery): Promise<ListStudioJobsResponse>
  getJob(id: string): Promise<StudioJob>
  sendToTimeline(id: string, body: SendToTimelineBody): Promise<SendToTimelineResponse>
}

export type DevStudioFallback = StudioBackend & {
  advanceJob(id: string, status: StudioJobStatus): StudioJob
  seedJob(job: StudioJob): void
  jobs(): StudioJob[]
}

export function createDevStudioFallback(opts?: {
  now?: () => number
  models?: StudioModel[]
  concurrencyLimit?: number
  knownProjectIds?: string[]
  autoAdvance?: boolean
}): DevStudioFallback {
  const now = opts?.now ?? (() => Date.now())
  const models = opts?.models ?? DEV_FALLBACK_MODELS
  const limit = opts?.concurrencyLimit ?? 2
  const knownProjects = opts?.knownProjectIds
  const jobs = new Map<string, StudioJob>()
  let seq = 0
  const iso = () => new Date(now()).toISOString()

  function modelById(id: string) {
    return models.find((m) => m.id === id)
  }

  function inFlightCount() {
    let n = 0
    for (const j of jobs.values()) if (j.status === 'queued' || j.status === 'running') n += 1
    return n
  }

  return {
    async listModels() {
      return { version: STUDIO_API_VERSION, models }
    },
    async uploadAsset(_file, _slot) {
      seq += 1
      return { id: `asset_dev_${seq}` }
    },
    async createJob(body) {
      const model = modelById(body.modelId)
      if (!model) err('UNKNOWN_MODEL', 'Unknown or disabled model', 400)
      if (!model.modes.includes(body.mode)) err('INVALID_PARAMS', `Mode ${body.mode} is not supported by ${model.id}`, 400)
      const prompt = (body.prompt ?? '').trim()
      if (!prompt) err('INVALID_PARAMS', 'Prompt is required', 400)
      if (body.aspect && !model.aspects.includes(body.aspect as StudioAspect)) {
        err('INVALID_PARAMS', `Aspect ${body.aspect} is not supported by ${model.id}`, 400)
      }
      if (model.kind === 'video') {
        const duration = body.durationSec
        if (duration != null && !model.durationsSec.includes(duration)) {
          err('INVALID_PARAMS', `Duration is not supported by ${model.id}`, 400)
        }
      }
      if (body.resolution && model.resolutions.length && !model.resolutions.includes(body.resolution)) {
        err('INVALID_PARAMS', `Resolution is not supported by ${model.id}`, 400)
      }
      if (body.mode === 'image_to_video' && !body.referenceAssetId && !body.startFrameAssetId) {
        err('INVALID_PARAMS', 'Image to video needs a reference or start frame', 400)
      }
      if (inFlightCount() >= limit) {
        err('CONCURRENCY_LIMIT', 'Too many generations already in progress', 409)
      }
      seq += 1
      const id = `job_dev_${seq}`
      const t = iso()
      const job: StudioJob = {
        id,
        status: 'queued',
        modelId: model.id,
        mode: body.mode,
        prompt,
        aspect: body.aspect ?? model.aspects[0] ?? null,
        durationSec: model.kind === 'video' ? (body.durationSec ?? model.durationsSec[0] ?? null) : null,
        resolution: body.resolution ?? model.resolutions[0] ?? null,
        creditEstimate: model.creditEstimate,
        projectId: body.projectId ?? null,
        output: null,
        error: null,
        createdAt: t,
        updatedAt: t,
        startedAt: null,
        completedAt: null,
      }
      jobs.set(id, job)
      return job
    },
    async listJobs(query = {}) {
      const limitN = Math.min(50, Math.max(1, query.limit ?? 24))
      let list = [...jobs.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      if (query.status) list = list.filter((j) => j.status === query.status)
      if (query.modelId) list = list.filter((j) => j.modelId === query.modelId)
      if (query.projectId) list = list.filter((j) => j.projectId === query.projectId)
      if (query.cursor) {
        const idx = list.findIndex((j) => j.id === query.cursor)
        list = idx >= 0 ? list.slice(idx + 1) : list
      }
      const page = list.slice(0, limitN)
      const next = list.length > limitN ? page[page.length - 1]?.id ?? null : null
      return { jobs: page, nextCursor: next }
    },
    async getJob(id) {
      const job = jobs.get(id)
      if (!job) err('JOB_NOT_FOUND', 'Job not found', 404)
      return job
    },
    async sendToTimeline(id, body) {
      const job = jobs.get(id)
      if (!job) err('JOB_NOT_FOUND', 'Job not found', 404)
      if (job.status !== 'done') err('JOB_NOT_READY', 'Job is not done', 409)
      if (!body.projectId) err('INVALID_PARAMS', 'projectId is required', 400)
      if (knownProjects && !knownProjects.includes(body.projectId)) {
        err('PROJECT_NOT_FOUND', 'Project not found', 404)
      }
      return { ok: true as const, projectId: body.projectId, clipId: body.clipId || `clip_dev_${id}` }
    },
    advanceJob(id, status) {
      const job = jobs.get(id)
      if (!job) err('JOB_NOT_FOUND', 'Job not found', 404)
      const t = iso()
      const next: StudioJob = { ...job, status, updatedAt: t }
      if (status === 'running') next.startedAt = job.startedAt ?? t
      if (status === 'done' || status === 'failed') next.completedAt = t
      if (status === 'done') {
        const path = STUDIO_PATHS.output(id)
        next.output = {
          kind: job.mode === 'text_to_image' ? 'image' : 'video',
          contentType: job.mode === 'text_to_image' ? 'image/png' : 'video/mp4',
          width: 1280,
          height: 720,
          durationSec: job.durationSec,
          previewUrl: path,
          downloadUrl: `${path}?download=1`,
        }
        next.error = null
      }
      if (status === 'failed') {
        next.error = { code: 'KIE_ERROR', message: 'The model provider couldn’t complete this generation.' }
        next.output = null
      }
      const parsed = parseStudioJob(next)
      jobs.set(id, parsed)
      return parsed
    },
    seedJob(job) {
      jobs.set(job.id, job)
    },
    jobs: () => [...jobs.values()],
  }
}
