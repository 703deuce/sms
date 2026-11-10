/** Posted youtube-video-v1 shape (contract doc not up yet). Field names are normalized in parse.ts. */

export const YOUTUBE_VIDEO_MAX_SOURCES = 5
export const YOUTUBE_VIDEO_URL_CAP_HOURS = 3
export const DEFAULT_YOUTUBE_VIDEO_POLL_MS = 2000

export const YOUTUBE_VIDEO_PATHS = {
  create: '/api/youtube-video',
  run: (runId: string) => `/api/youtube-video/${encodeURIComponent(runId)}`,
  choose: (runId: string) => `/api/youtube-video/${encodeURIComponent(runId)}/choose`,
  revert: (runId: string) => `/api/youtube-video/${encodeURIComponent(runId)}/revert`,
} as const

export type YoutubeVideoUploadSource = { kind: 'upload'; projectId: string }
export type YoutubeVideoUrlSource = { kind: 'url'; url: string }
export type YoutubeVideoSource = YoutubeVideoUploadSource | YoutubeVideoUrlSource

export type YoutubeVideoStatus = 'queued' | 'importing' | 'running' | 'done' | 'failed'

export type YoutubeVideoError = { code: string; message: string }

export type YoutubeVideoBeatRange = {
  sourceId?: string
  startMs: number
  endMs: number
}

export type YoutubeVideoBeat = {
  label: string
  ranges: YoutubeVideoBeatRange[]
  evidence?: unknown
}

export type YoutubeVideoChapter = {
  title: string
  startMs: number
}

export type YoutubeVideoOption = {
  optionId: string
  title?: string
  beats: YoutubeVideoBeat[]
  chapters: YoutubeVideoChapter[]
  chapterText?: string
}

export type YoutubeVideoPlan = {
  title?: string
  summary?: string
  options: YoutubeVideoOption[]
  chapters: YoutubeVideoChapter[]
  chapterText?: string
}

export type YoutubeVideoRun = {
  runId: string
  status: YoutubeVideoStatus
  stage: string
  progress?: number
  error?: YoutubeVideoError
  creditEstimate?: number
  clipId?: string
  projectId?: string
  editorUrl?: string
  durationMs?: number
  playbackUrl?: string
  thumbnailUrl?: string
  downloadUrl?: string
  plan?: YoutubeVideoPlan
  options: YoutubeVideoOption[]
  chosenOptionId?: string
}

export type CreateYoutubeVideoBody = {
  sources: YoutubeVideoSource[]
  title?: string
  clientRequestId: string
}

export const YOUTUBE_VIDEO_STATUSES: readonly YoutubeVideoStatus[] = [
  'queued',
  'importing',
  'running',
  'done',
  'failed',
]
