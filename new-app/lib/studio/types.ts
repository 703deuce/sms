export const STUDIO_REGISTRY_VERSION = 1 as const

export type StudioJobStatus = 'queued' | 'running' | 'done' | 'failed'
export type StudioMediaKind = 'video' | 'image'
export type StudioMode = 'text_to_video' | 'image_to_video' | 'text_to_image' | 'source_video_edit'
export type StudioAspect = '9:16' | '16:9' | '1:1'

export type StudioModelPublic = {
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
  sourceVideoEdit?: {
    minDurationSec: number
    maxDurationSec: number
    creditPerSecondByResolution: Record<string, number>
  }
}

export type StudioRegistryDocument = {
  version: typeof STUDIO_REGISTRY_VERSION
  models: StudioModelPublic[]
}

export type StudioCreateJobInput = {
  modelId: string
  mode: StudioMode
  prompt: string
  aspect?: StudioAspect
  durationSec?: number
  resolution?: string
  referenceAssetId?: string
  startFrameAssetId?: string
  endFrameAssetId?: string
  sourceVideoAssetId?: string
  projectId?: string
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
  error: { code: string; message: string } | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}

export type StudioJobRecord = {
  id: string
  workspaceId: string
  userId: string
  projectId: string | null
  status: StudioJobStatus
  modelId: string
  mode: StudioMode
  prompt: string
  aspect: string | null
  durationSec: number | null
  resolution: string | null
  creditEstimate: number
  provider: string
  providerTaskId: string | null
  providerApi: 'jobs' | 'veo' | null
  referenceAssetId: string | null
  startFrameAssetId: string | null
  endFrameAssetId: string | null
  sourceVideoAssetId: string | null
  outputStorageKey: string | null
  outputStorageDriver: string | null
  outputContentType: string | null
  outputWidth: number | null
  outputHeight: number | null
  outputDurationSec: number | null
  outputKind: StudioMediaKind | null
  outputUploadId: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

export type StudioAssetRecord = {
  id: string
  workspaceId: string
  userId: string
  storageKey: string
  storageDriver: string | null
  contentType: string
  bytes: number | null
  kind: string
  createdAt: Date
}

export type KieCreateRequest = {
  api: 'jobs' | 'veo'
  model: string
  input: Record<string, unknown>
}

export type KieTaskSnapshot = {
  state: 'running' | 'success' | 'fail'
  failMsg?: string
  resultUrl?: string
  contentTypeHint?: string
  creditsConsumed?: number
}
