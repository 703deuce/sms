/** Types from docs/contracts/ai-studio-v1.md (PR #1135). Do not invent fields. */

export const STUDIO_API_VERSION = 1 as const

export type StudioJobStatus = 'queued' | 'running' | 'done' | 'failed'
export type StudioMediaKind = 'video' | 'image'
export type StudioMode = 'text_to_video' | 'image_to_video' | 'text_to_image'
export type StudioAspect = '9:16' | '16:9' | '1:1'

export const STUDIO_JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const
export const STUDIO_MEDIA_KINDS = ['video', 'image'] as const
export const STUDIO_MODES = ['text_to_video', 'image_to_video', 'text_to_image'] as const
export const STUDIO_ASPECTS = ['9:16', '16:9', '1:1'] as const

/** Launch ids from the contract. Seedance 2.5 is explicitly not included. */
export const STUDIO_LAUNCH_MODEL_IDS = [
  'veo-3.1-lite',
  'veo-3.1-fast',
  'veo-3.1-quality',
  'hailuo-2.3',
  'seedance-2.0-mini',
  'flux-2-pro',
  'nano-banana',
  'nano-banana-pro',
] as const

export const STUDIO_DEFAULT_VIDEO_MODEL_ID = 'seedance-2.0-mini'
export const STUDIO_DEFAULT_IMAGE_MODEL_ID = 'flux-2-pro'

export const STUDIO_ERROR_CODES = [
  'INVALID_PARAMS',
  'UNKNOWN_MODEL',
  'CONCURRENCY_LIMIT',
  'JOB_NOT_READY',
  'JOB_NOT_FOUND',
  'PROJECT_NOT_FOUND',
  'KIE_ERROR',
  'STORAGE_ERROR',
] as const

export type StudioErrorCode = (typeof STUDIO_ERROR_CODES)[number]

export type StudioModel = {
  id: string
  label: string
  kind: StudioMediaKind
  modes: StudioMode[]
  supportsStartEndFrame: boolean
  supportsReferenceImage: boolean
  aspects: StudioAspect[]
  durationsSec: number[]
  resolutions: string[]
  creditEstimate: number
}

export type StudioModelRegistry = {
  version: typeof STUDIO_API_VERSION
  models: StudioModel[]
}

export type StudioJobOutput = {
  kind: StudioMediaKind
  contentType: string
  width: number | null
  height: number | null
  durationSec: number | null
  previewUrl: string
  downloadUrl: string
}

export type StudioJobError = {
  code: string
  message: string
}

export type StudioJob = {
  id: string
  status: StudioJobStatus
  modelId: string
  mode: StudioMode
  prompt: string
  aspect: StudioAspect | null
  durationSec: number | null
  resolution: string | null
  creditEstimate: number
  projectId: string | null
  output: StudioJobOutput | null
  error: StudioJobError | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}

export type CreateStudioJobBody = {
  modelId: string
  mode: StudioMode
  prompt: string
  aspect?: StudioAspect
  durationSec?: number
  resolution?: string
  referenceAssetId?: string
  startFrameAssetId?: string
  endFrameAssetId?: string
  projectId?: string
}

export type ListStudioJobsQuery = {
  limit?: number
  cursor?: string
  status?: StudioJobStatus
  modelId?: string
  projectId?: string
}

export type ListStudioJobsResponse = {
  jobs: StudioJob[]
  nextCursor: string | null
}

export type SendToTimelineBody = {
  projectId: string
  clipId?: string
}

export type SendToTimelineResponse = {
  ok: true
  projectId: string
  clipId: string
}

export type StudioApiErrorBody = {
  error: string
  code: string
}

/**
 * Assumed multipart fields for POST /api/studio/assets (not named in the contract).
 * Raised as a gap on PR #1135.
 */
export type StudioAssetSlot = 'reference' | 'start_frame' | 'end_frame'

export const STUDIO_ASSET_SLOTS: StudioAssetSlot[] = ['reference', 'start_frame', 'end_frame']

export const STUDIO_PATHS = {
  models: '/api/studio/models',
  assets: '/api/studio/assets',
  jobs: '/api/studio/jobs',
  job: (id: string) => `/api/studio/jobs/${encodeURIComponent(id)}`,
  output: (id: string) => `/api/studio/jobs/${encodeURIComponent(id)}/output`,
  sendToTimeline: (id: string) => `/api/studio/jobs/${encodeURIComponent(id)}/send-to-timeline`,
} as const

/** Existing editor API reused for the Send-to-timeline project picker. Not a studio contract field. */
export const EDITOR_PROJECTS_PATH = '/api/clips/projects'

export const DEFAULT_STUDIO_POLL_MS = 2000
export const DEFAULT_STUDIO_HISTORY_LIMIT = 24
