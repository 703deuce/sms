/**
 * Typed client for standalone AI Captions, aligned to
 * docs/contracts/ai-captions-v1.md at #1147 head 5133caac.
 * Routes land in #1147 (draft); this client is mocked in tests.
 */

export const CAPTIONS_RUN_CREDITS = 10
export const AI_CAPTIONS_DEFAULT_STYLE_ID = 'clean_white'

export const AI_CAPTIONS_BUILTIN_STYLE_IDS = [
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

export type AiCaptionsStage =
  | 'queued'
  | 'prepare'
  | 'transcribe'
  | 'captions'
  | 'export'
  | 'ready'

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

export type AiCaptionsRun = {
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

export type AiCaptionsCreateData = {
  runId: string
  status: AiCaptionsStatus
  creditEstimate: number
}

export type AiCaptionsStylesData = {
  defaultStyleId: typeof AI_CAPTIONS_DEFAULT_STYLE_ID | string
  lastStyleId: string | null
  styles: AiCaptionsStyle[]
}

export type AiCaptionsExportData = {
  runId: string
  status: AiCaptionsStatus
  downloadUrl: string | null
  srtUrl: string
}

export function createCaptionsSource(
  input:
    | { uploadId: string }
    | { projectId: string; assetId?: undefined }
    | { projectId: string; assetId: string },
): AiCaptionsSource {
  if ('uploadId' in input) return { kind: 'upload', uploadId: input.uploadId }
  if ('assetId' in input && input.assetId) {
    return { kind: 'asset', projectId: input.projectId, assetId: input.assetId }
  }
  return { kind: 'project', projectId: input.projectId }
}

/** Compact clip-editor captions URL, always built from projectId + clipId (do not trust result.editorUrl).
 *  #1133 308s /app/clips/:projectId/edit/:clipId to /app/video-editor/.../edit/... and preserves the query. */
export function captionsEditorHref(projectId: string, clipId: string): string | null {
  const project = projectId.trim()
  const clip = clipId.trim()
  if (!project || !clip) return null
  return `/app/clips/${project}/edit/${clip}?tab=captions`
}

export function captionsRedirectFromRun(run: Pick<AiCaptionsRun, 'status' | 'projectId' | 'result'>): string | null {
  if (run.status !== 'ready') return null
  const projectId = run.result?.projectId || run.projectId || ''
  const clipId = run.result?.clipId || ''
  return captionsEditorHref(projectId, clipId)
}

export function captionsCreditCount(creditEstimate?: number | null): number {
  return typeof creditEstimate === 'number' && Number.isFinite(creditEstimate) && creditEstimate > 0
    ? Math.round(creditEstimate)
    : CAPTIONS_RUN_CREDITS
}

const IN_PROGRESS: ReadonlySet<AiCaptionsStatus> = new Set([
  'queued',
  'preparing',
  'transcribing',
  'captioning',
  'exporting',
])

export function isCaptionsRunInProgress(status: AiCaptionsStatus): boolean {
  return IN_PROGRESS.has(status)
}

export function captionsProgressLabel(status: AiCaptionsStatus, stage?: AiCaptionsStage | null): string {
  if (status === 'preparing' || stage === 'prepare') return 'Preparing your video…'
  if (status === 'transcribing' || stage === 'transcribe') return 'Transcribing…'
  if (status === 'captioning' || stage === 'captions') return 'Generating captions…'
  if (status === 'exporting' || stage === 'export') return 'Finishing captions…'
  if (status === 'ready' || stage === 'ready') return 'Captions are ready.'
  return 'Starting captions…'
}
