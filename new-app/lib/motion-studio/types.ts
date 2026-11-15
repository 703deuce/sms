/**
 * Motion Studio (documentary-first) client types.
 * Mirrors the planned `/api/motion-studio/*` contract (spec ST-API-001, ST-DM-001).
 * Field names are the frontend's working assumption until Backend publishes
 * its contract doc; the live adapter normalizes in one place.
 */

export type MsWorkflow = 'idea' | 'script' | 'footage'
/** v1 is fixed to uploads_only (ST-UI-107); the enum keeps all three for the later picker. */
export type MsMediaPolicy = 'auto_plus_uploads' | 'auto_only' | 'uploads_only'
export type MsLengthMin = 3 | 5 | 10 | 15
export type MsVisualDirection = 'cinematic' | 'explainer' | 'investigative' | 'technical_3d'
export type MsVoiceover = 'ai' | 'upload'
export type MsProductionMode = 'checkpoint' | 'auto'
export type MsFormat = '16:9_1080p'

/** Contract v1.1 `settings.music` (PATCH-only extra). `elevenlabs` is the optional premium tier (#1230). */
export type MsMusicChoice = 'generated' | 'upload' | 'elevenlabs' | 'none'

export type MsSettings = {
  lengthMin: MsLengthMin
  visualDirection: MsVisualDirection
  voiceover: MsVoiceover
  format: MsFormat
  productionMode: MsProductionMode
  music?: MsMusicChoice
  /** When true, story research may use Gemini grounded web search. Off by default. */
  webResearch?: boolean
  /** Pixel size for Motion Studio renders ('480p', '1080p', or '1920x1080'). Omit to use the worker default (480p while testing). */
  renderSize?: string
}

export type MsProjectStatus =
  | 'setup'
  | 'planning'
  | 'awaiting_review'
  | 'producing'
  | 'review'
  | 'exporting'
  | 'complete'
  | 'failed'

export type MsStageId = 'story' | 'assets' | 'direct' | 'graphics' | 'assemble' | 'review'
export type MsStageStatus = 'pending' | 'running' | 'done' | 'needs_review' | 'failed'

export type MsStage = {
  id: MsStageId
  status: MsStageStatus
  /** e.g. "12 of 15 scenes" */
  progressLabel?: string | null
  error?: string | null
}

/** Production Activity steps (ST-UI-104). The v1 list hides "media candidates discovered". */
export type MsActivityStepId = 'story_research' | 'uploads_analyzed' | 'storyboard' | 'motion_graphics' | 'assembly_review'

export type MsActivityStep = {
  id: MsActivityStepId
  status: MsStageStatus
  counts?: string | null
  latestAction?: string | null
}

export type MsActivityEvent = {
  id: string
  at: string
  stage: MsStageId
  /** reasoning = the director's thinking; action = what it did; status = step transition */
  kind: 'reasoning' | 'action' | 'status' | 'warning'
  text: string
}

export type MsSource = { title: string; url: string }

export type MsScriptLine = {
  id: string
  text: string
  sources: MsSource[]
}

export type MsChapter = {
  id: string
  index: number
  title: string
  summary: string
  lines: MsScriptLine[]
}

export type MsStory = {
  chapters: MsChapter[]
  approved: boolean
  /** WF-B: the user's words are kept verbatim. */
  preservedUserScript: boolean
  changeRequest?: string | null
}

export type MsVisualType = 'footage' | 'photo' | 'diagram' | 'map' | 'chart' | 'cinematic' | 'interview' | 'text'
/** Inspector selection type (ST-UX-054). */
export type MsSelectionKind = 'chart' | 'photo' | 'clip' | 'text' | 'scene'

export type MsHandoff = {
  assetId: string
  /** 1. Approach · 2. Play footage · 3. Return (ST-UX-090) */
  approachMs: number
  footageMs: number
  returnMs: number
  exit: 'return' | 'cut'
}

export type MsSceneStatus = 'planned' | 'rendering' | 'ready' | 'failed'

export type MsScene = {
  id: string
  chapterId: string
  index: number
  startMs: number
  endMs: number
  title: string
  treatment: string
  description: string
  visualType: MsVisualType
  kind: MsSelectionKind
  reason: string
  tags: string[]
  graphicName: string
  style: string
  camera: string
  source: string
  text: string
  status: MsSceneStatus
  thumbnailUrl?: string | null
  assetIds: string[]
  handoff?: MsHandoff | null
  version: number
  /** Contract v1.1 optional fields. */
  previewUrl?: string | null
  error?: string | null
  /** Editable scene elements (text, graphics, media, animation, audio). */
  elements?: MsSceneElement[]
  params?: Record<string, string | number | boolean>
}

export type MsSceneElement = {
  id: string
  kind: 'environment' | 'media' | 'graphic' | 'text' | 'animation' | 'audio' | 'camera' | string
  [key: string]: unknown
}

export type MsAssetKind = 'photo' | 'video' | 'audio' | 'script'
export type MsAnalysisStatus = 'queued' | 'analyzing' | 'ready' | 'failed'

export type MsAsset = {
  id: string
  kind: MsAssetKind
  label: string
  /** Short-lived preview URL only; never a raw storage key. */
  url?: string | null
  durationMs?: number | null
  role?: 'footage' | 'photo' | 'music' | 'narration' | 'script'
  analysis: {
    status: MsAnalysisStatus
    summary?: string | null
    transcriptExcerpt?: string | null
    faces?: number | null
    objects?: string[]
    shots?: number | null
  }
  intendedUse?: string | null
  chapterId?: string | null
  sceneIds: string[]
  uploadedAt: string
}

export type MsMissingVisual = { id: string; chapterId: string; description: string }

/** effect = what accepting re-renders (e.g. "Re-renders scene 3 only"). */
export type MsProposalItem = { id: string; text: string; status: 'pending' | 'accepted' | 'rejected'; effect?: string | null }
export type MsProposal = { id: string; request: string; sceneId?: string | null; createdAt: string; items: MsProposalItem[] }
export type MsDirectorMessage = { id: string; role: 'user' | 'director'; text: string; at: string; proposalId?: string | null }

export type MsAllowanceItem = { id: string; label: string; included: boolean; thirdParty: boolean; credits: number | null }
export type MsAllowance = {
  /** null while charging is off (contract v1.1) → shown as "Included". */
  estimateCredits: number | null
  minutes: number
  items: MsAllowanceItem[]
}

export type MsExport = {
  status: 'idle' | 'queued' | 'rendering' | 'ready' | 'failed'
  progress: number
  filename?: string | null
  error?: string | null
}

export type MsAudio = {
  voice: { mode: MsVoiceover; label: string; status: MsSceneStatus; assetId?: string | null }
  music: { source: 'generated' | 'upload'; label: string; assetId?: string | null; status: MsSceneStatus }
}

export type MsProject = {
  id: string
  title: string
  isExample: boolean
  createdAt: string
  updatedAt: string
  workflow: MsWorkflow
  prompt: string
  mediaPolicy: MsMediaPolicy
  settings: MsSettings
  status: MsProjectStatus
  stages: MsStage[]
  activity: MsActivityStep[]
  story: MsStory | null
  scenes: MsScene[]
  assets: MsAsset[]
  missingVisuals: MsMissingVisual[]
  audio: MsAudio
  durationMs: number
  /** Assembled preview (short-lived URL) once a render exists. */
  previewUrl?: string | null
  styleRationale?: string | null
  proposals: MsProposal[]
  director: MsDirectorMessage[]
  allowance: MsAllowance | null
  export: MsExport
  error?: string | null
}

export type MsProjectSummary = Pick<MsProject, 'id' | 'title' | 'isExample' | 'createdAt' | 'updatedAt' | 'status' | 'workflow'> & {
  sceneCount: number
  durationMs: number
  thumbnailUrl?: string | null
  /** FE-only hint for the code-rendered cover when there is no thumbnail (first scene's visual type). */
  posterKind?: MsVisualType | null
}

export type MsUploadInput = { uploadId: string; kind: MsAssetKind; label: string; durationMs?: number | null }

export type MsCreateInput = {
  workflow: MsWorkflow
  prompt: string
  script?: string | null
  uploads: MsUploadInput[]
  mediaPolicy: 'uploads_only'
  idempotencyKey: string
}

export type MsScenePatch = Partial<Pick<MsScene, 'startMs' | 'endMs' | 'style' | 'camera' | 'text'>> & {
  /** Photo: crop/depth/animation; clip: trim/sound (Footage Editor action, ST-BND-002). */
  params?: Record<string, string | number | boolean>
  /** Targeted element patches; re-render this scene without a new model call. */
  elements?: MsSceneElement[]
  elementPatches?: MsSceneElement[]
}

export type MsEditorHandoff = { clipProjectId: string; clipId: string }
