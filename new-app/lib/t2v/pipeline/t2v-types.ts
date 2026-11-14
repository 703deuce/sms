/**
 * Prompt-to-Video (stock footage MVP) pipeline types.
 *
 * This is the Text-to-Video product's own multi-agent pipeline (Story → Script → Scene planner →
 * Footage researcher → Visual reviewer (worker) → Narration → Finisher → QA → Render). It mirrors
 * the YouTube maker's agent layout but shares no modules, prompts or run records with it.
 * Run state lives on the T2V draft row (`document.autobuild`).
 */

export type T2vPipelineStyle = 'documentary' | 'educational' | 'explainer' | 'marketing' | 'social'

export const T2V_PIPELINE_STYLES: Array<{ id: T2vPipelineStyle; label: string }> = [
  { id: 'documentary', label: 'Documentary' },
  { id: 'educational', label: 'Educational' },
  { id: 'explainer', label: 'Explainer' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'social', label: 'Social' },
]

/** Styles that must use real live-action footage (no animation, 3D renders, motion graphics, clip-art). */
export function t2vRealisticStyle(style: T2vPipelineStyle | string | undefined): boolean {
  return style !== 'social'
}

/** ElevenLabs premade narrators (verified on the account). Default: American male documentary. */
export const T2V_PIPELINE_NARRATORS: Array<{ voiceId: string; name: string; description: string }> = [
  { voiceId: 'nPczCjzI2devNBz1zQrb', name: 'Brian', description: 'American male · deep, documentary' },
  { voiceId: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'American male · wise, mature' },
  { voiceId: 'cjVigY5qzO86Huf0OWal', name: 'Eric', description: 'American male · smooth, trustworthy' },
  { voiceId: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'American female · professional' },
  { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'American female · confident' },
  { voiceId: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'British male · broadcaster' },
  { voiceId: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'British male · storyteller' },
]
export const T2V_PIPELINE_DEFAULT_NARRATOR = T2V_PIPELINE_NARRATORS[0]!

export const T2V_PIPELINE_DURATIONS = [30, 45, 60, 90, 120, 180, 240, 300] as const
export type T2vPipelineDuration = (typeof T2V_PIPELINE_DURATIONS)[number]

/** Ordered customer-visible stages. A stage is complete only when the backend finished it. */
export const T2V_PIPELINE_STAGES = [
  { id: 'writing_script', label: 'Writing script' },
  { id: 'planning_scenes', label: 'Planning scenes' },
  { id: 'finding_footage', label: 'Finding footage' },
  { id: 'verifying_footage', label: 'Verifying footage' },
  { id: 'generating_narration', label: 'Generating narration' },
  { id: 'editing_video', label: 'Editing video' },
  { id: 'rendering', label: 'Rendering' },
] as const
export type T2vPipelineStageId = (typeof T2V_PIPELINE_STAGES)[number]['id']
export type T2vPipelineStatus = T2vPipelineStageId | 'queued' | 'done' | 'failed'

/** Agent A output. */
export type T2vStoryPlan = {
  title: string
  topic: string
  audience: string
  tone: string
  hook: string
  keyPoints: string[]
  ending: string
  targetSeconds: number
  musicMood: string
}

/** Agent B output — narration segments with stable ids. */
export type T2vNarrationSegment = {
  id: string
  purpose: string
  narration: string
  visualMeaning: string
  targetSeconds: number
  emotion: string
}

/** Agent C output — one shot per spoken sentence (the narration drives the visuals). */
export type T2vPlannedShot = {
  sceneId: string
  segmentId: string
  narration: string
  intent: string
  queries: string[]
  needS: number
  onScreenText?: string
}

export type T2vFootageCandidate = {
  provider: 'pixabay' | 'pexels'
  providerId: string
  previewUrl: string
  durationS: number
  width: number
  height: number
  query: string
  tags: string[]
  srcUrl: string
  thumbUrl: string
  pageUrl: string
  author: string
}

export type T2vVerifiedPick = {
  provider: string
  providerId: string
  query?: string
  visible: string
  subject?: string
  action?: string
  matches: boolean
  score: number
  inS: number
  outS: number
  clipS: number
  issues?: string
  style?: string
  lighting?: number
  framing?: string
  /** 64-bit dHash hex of 3 frames in the window (near-duplicate check). */
  phash?: string[]
  /** Stock author (same-shoot check: same author + neighbouring IDs). */
  author?: string
  /** best_available = nothing passed review; the highest-scoring on-topic clip is used instead of a card. */
  verdict: 'accepted' | 'weak_match' | 'best_available'
}

export type T2vShotResult = {
  sceneId: string
  chosen: T2vVerifiedPick | null
  evaluated: Array<Partial<T2vVerifiedPick> & { providerId: string; error?: string }>
  /** What the edit uses: verified stock or an honest title card. */
  /** held = no clip passed review, so the previous verified clip keeps running under this line. */
  outcome?: 'stock' | 'held' | 'title_card'
}

export type T2vQaReport = {
  at: string
  pass: boolean
  checks: Array<{ id: string; ok: boolean; detail: string }>
}

export type T2vStageLog = { stage: T2vPipelineStatus; at: string; note?: string }

export type T2vPipelineRun = {
  v: 1
  prompt: string
  style: T2vPipelineStyle
  durationS: number
  renderResolution: '480p' | '720p' | '1080p'
  status: T2vPipelineStatus
  completed: T2vPipelineStageId[]
  log: T2vStageLog[]
  error?: string
  story?: T2vStoryPlan
  segments?: T2vNarrationSegment[]
  shots?: T2vPlannedShot[]
  candidates?: Record<string, T2vFootageCandidate[]>
  verifyJobId?: string
  /** Search/verify rounds done (0 = first pass). Unresolved shots get new adjacent queries each round. */
  verifyRound?: number
  /** Best result per scene across all verify rounds. */
  verifyHistory?: Record<string, T2vShotResult>
  /** Every query searched per scene (so later rounds never repeat one). */
  queriesTried?: Record<string, string[]>
  /** Per-run stock success metrics (tracked so a later AI-generation fallback stays a small minority). */
  stockStats?: { shots: number; accepted: number; weak: number; bestAvailable: number; held: number; titleCards: number; verifiedRate: number; ownClipRate?: number; stockCoverage: number; rounds: number }
  verifySummary?: Record<string, number | string>
  results?: T2vShotResult[]
  musicGenerationId?: string
  assembleJobId?: string
  compositionId?: string
  renderId?: string
  qa?: T2vQaReport[]
  resumes?: number
  startedAt: string
  finishedAt?: string
}
