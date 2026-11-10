export const AI_CAPTIONS_DEFAULT_STYLE_ID = 'clean_white'
export const LOW_CONFIDENCE_THRESHOLD = 0.5
export const CAPTIONS_RUN_CREDITS_PLACEHOLDER = 10

export const BUILTIN_STYLE_IDS = [
  'clean_white',
  'bold_pop',
  'boxed',
  'karaoke',
  'minimal',
  'neon',
  'bounce',
  'typewriter',
  'slide_up',
  'highlighter',
  'word_pop',
  'karaoke_highlight',
  'heavy_outline',
  'lower_third',
] as const

export type AiCaptionsBuiltinStyleId = (typeof BUILTIN_STYLE_IDS)[number]

export type AiCaptionsSource =
  | { kind: 'upload'; uploadId: string }
  | { kind: 'project'; projectId: string }
  | { kind: 'asset'; projectId: string; assetId: string }

export type AiCaptionsStatus =
  | 'queued'
  | 'preparing'
  | 'transcribing'
  | 'captioning'
  | 'exporting'
  | 'ready'
  | 'failed'

export type AiCaptionsStage = 'queued' | 'prepare' | 'transcribe' | 'captions' | 'export' | 'ready'

export type AiCaptionsWord = {
  text: string
  startMs: number
  endMs: number
  confidence?: number
  lowConfidence: boolean
}

export type AiCaptionsLine = {
  id: string
  text: string
  startMs: number
  endMs: number
}

export type AiCaptionsStyle = {
  styleId: string
  name: string
  kind: 'builtin' | 'saved'
}

export type AiCaptionsResult = {
  clipId: string
  projectId: string
  editorUrl: string
  durationMs: number
  styleId: string
  captionsEnabled: true
  bounds: { startMs: 0; endMs: number }
  words: AiCaptionsWord[]
  lines: AiCaptionsLine[]
  playbackUrl: string | null
  thumbnailUrl: string | null
  downloadUrl: string | null
  srtUrl: string
}

export type AiCaptionsCreateBody = {
  clientRequestId?: string
  source: AiCaptionsSource
  styleId?: string
}

export type AiCaptionsCreateView = {
  runId: string
  status: AiCaptionsStatus
  creditEstimate: number
}

export type AiCaptionsRunView = {
  runId: string
  status: AiCaptionsStatus
  stage: AiCaptionsStage | null
  progressPercent: number | null
  failureCode: string | null
  failureMessage: string | null
  creditEstimate: number | null
  styleId: string | null
  projectId: string | null
  result: AiCaptionsResult | null
}

export type AiCaptionsStylesView = {
  defaultStyleId: typeof AI_CAPTIONS_DEFAULT_STYLE_ID
  lastStyleId: string | null
  styles: AiCaptionsStyle[]
}

/** Transcript word as stored on a project (s/e in seconds, p is ASR confidence). */
export type TranscriptWord = { w: string; s: number; e: number; p?: number }

export function editorUrlFor(projectId: string, clipId: string): string {
  return `/app/clips/${projectId}/edit/${clipId}?tab=captions`
}

export function srtUrlFor(runId: string): string {
  return `/api/ai-captions/runs/${runId}/srt`
}

export function isBuiltinStyleId(styleId: string): styleId is AiCaptionsBuiltinStyleId {
  return (BUILTIN_STYLE_IDS as readonly string[]).includes(styleId)
}
