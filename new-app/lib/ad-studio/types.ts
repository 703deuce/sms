export const AD_STUDIO_ASPECTS = ['9:16', '16:9', '1:1'] as const
export type AdStudioAspect = (typeof AD_STUDIO_ASPECTS)[number]

export const AD_STUDIO_DURATIONS = [15, 30] as const
export type AdStudioDurationSec = (typeof AD_STUDIO_DURATIONS)[number]

export const AD_STUDIO_MODES = ['storyline', 'image_to_ad'] as const
export type AdStudioMode = (typeof AD_STUDIO_MODES)[number]

export const AD_STUDIO_STATUSES = [
  'draft',
  'planning',
  'plan_ready',
  'confirming',
  'generating',
  'stitching',
  'done',
  'failed',
  'cancelled',
] as const
export type AdStudioStatus = (typeof AD_STUDIO_STATUSES)[number]

export type AdProductInput = {
  name: string
  url?: string
  sellingPoints: string[]
  audience?: string
  brandNotes?: string
  aspect: AdStudioAspect
  durationSec: AdStudioDurationSec
  imageAssetIds: string[]
  logoAssetId?: string
}

export type AdScript = {
  hook: string
  problem: string
  solution: string
  cta: string
  voiceover: string
  onScreenText: string[]
}

export type AdImagery = {
  imageJobIds: string[]
  preservedSourceAssetIds: string[]
}

export type AdSceneRole = 'hook' | 'problem' | 'solution' | 'cta' | 'other'
export type AdSceneSource = 'stock' | 'generated'

export type AdScene = {
  index: number
  role: AdSceneRole
  durationSec: number
  source: AdSceneSource
  reason: string
  providerId?: string
  stockAssetId?: string
  sourceInMs?: number
  sourceOutMs?: number
  stockQuery?: string
  studioJobId?: string
  modelId?: string
  prompt?: string
  referenceAssetId?: string
  startMs: number
  endMs: number
  onScreenText?: string
  status?: 'planned' | 'ready' | 'failed' | 'skipped'
}

export type AdPlan = {
  script: AdScript
  imagery: AdImagery
  scenes: AdScene[]
  creditEstimate: number | null
  modelStrategy: string
}

export type AdStudioRun = {
  id: string
  status: AdStudioStatus
  mode: AdStudioMode
  input: AdProductInput
  plan: AdPlan | null
  creditEstimate: number | null
  creditCharged: number | null
  projectId: string | null
  clipId: string | null
  compactEditorUrl: string | null
  fullEditorUrl: string | null
  error: null | { code: string; message: string }
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type AdStudioCosts = {
  storyline_15: number | null
  storyline_30: number | null
  image_to_ad_15: number | null
  image_to_ad_30: number | null
}

export type AdStudioConfig = {
  version: 1
  aspects: AdStudioAspect[]
  durationsSec: [15, 30]
  costs: AdStudioCosts
}

export type AdStudioHistoryItem = {
  id: string
  title: string
  kind: 'studio_job' | 'ad_run'
  status: string
  createdAt: string
}

export class AdStudioHttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AdStudioHttpError'
    this.status = status
    this.code = code
  }
}
