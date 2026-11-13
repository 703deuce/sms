export const YOUTUBE_VIDEO_STATUSES = [
  'queued',
  'importing',
  'waiting_for_source',
  'running',
  'awaiting_choice',
  'needs_review',
  'ready',
  'failed',
  'canceled',
] as const

export type YoutubeVideoStatus = (typeof YOUTUBE_VIDEO_STATUSES)[number]

export const YOUTUBE_VIDEO_STAGES = [
  'importing',
  'ingest',
  'waiting_for_source',
  'planning',
  'assembling',
  'applying',
  'rendering',
] as const

export type YoutubeVideoStage = (typeof YOUTUBE_VIDEO_STAGES)[number]

export type YoutubeVideoBeat = {
  label: string
  startMs?: number
  endMs?: number
  sourceId?: string
  evidence?: string
}

export type YoutubeVideoOption = {
  id: string
  title: string
  premise: string
  beats: YoutubeVideoBeat[]
  estDurationMs?: number
}

export type YoutubeVideoPlan = {
  premise: string
  beats: YoutubeVideoBeat[]
}

export type YoutubeVideoChapter = {
  title: string
  startMs: number
}

export type YoutubeVideoResult = {
  clipId: string
  projectId: string
  renderId?: string | null
  editorUrl: string
  durationMs: number
  durationSeconds: number
  playbackUrl: string | null
  thumbnailUrl: string | null
  downloadUrl: string | null
  plan: YoutubeVideoPlan
  chapters: YoutubeVideoChapter[]
  chapterText: string
  /** Sanitized long-form planning audit, retained after the final MP4 render. */
  analysisAudit?: {
    premise?: string
    needsReview?: boolean
    globalQaIssues?: string[]
    globalQaIssueHistory?: string[]
    scenes?: Array<{sourceId:string;startMs:number;endMs:number;title:string;reason:string}>
    cutSpans?: Array<{sourceId:string;startMs:number;endMs:number;durationMs:number;category:string;reason:string;sceneContext:string}>
    qaRevisions?: Array<{scope:string;round:number;status:string;issues:string[];explanation:string;changes?:string}>
    steps: import('@/lib/youtube-video/pipeline/yt-types').YtStep[]
    windows: Array<{
      sourceIndex:number;startMs:number;endMs:number
      acceptedCuts:Array<{sourceId:string;startMs:number;endMs:number}>
      rejectedCuts:Array<{startMs:number;endMs:number;code:string}>
      qaPassed?: boolean
      qaIssues?: string[]
      qaIssueHistory?: string[]
    }>
  }
}

export type YoutubeVideoUploadSource = { kind: 'upload'; projectId: string }
export type YoutubeVideoUrlSource = { kind: 'url'; url: string }
export type YoutubeVideoSource = YoutubeVideoUploadSource | YoutubeVideoUrlSource

export type YoutubeVideoCreateInput = {
  clientRequestId?: string
  instruction?: string
  sources: YoutubeVideoSource[]
}

export type YoutubeVideoRunView = {
  runId: string
  status: YoutubeVideoStatus
  stage: YoutubeVideoStage | null
  progressPercent: number | null
  failureCode: string | null
  failureMessage: string | null
  creditsEstimated: number | null
  options: YoutubeVideoOption[] | null
  result: YoutubeVideoResult | null
  analysisAudit?: YoutubeVideoResult['analysisAudit'] | null
}

export type YoutubeVideoWord = {
  w: string
  s: number
  e: number
  spk?: string | null
}

export type YoutubeVideoIngestedSource = {
  sourceId: string
  projectId: string
  title?: string
  durationMs: number
  words: YoutubeVideoWord[]
}

export type YoutubeVideoCut = {
  sourceId: string
  startMs: number
  endMs: number
  label?: string
}
