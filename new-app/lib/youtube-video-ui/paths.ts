export const YOUTUBE_VIDEO_MAX_SOURCES = 5
export const YOUTUBE_VIDEO_URL_CAP_HOURS = 3
export const DEFAULT_YOUTUBE_VIDEO_POLL_MS = 2000

export const YOUTUBE_VIDEO_PATHS = {
  create: '/api/youtube-video/runs',
  run: (runId: string) => `/api/youtube-video/runs/${encodeURIComponent(runId)}`,
  choose: (runId: string) => `/api/youtube-video/${encodeURIComponent(runId)}/choose`,
  revert: (runId: string) => `/api/youtube-video/${encodeURIComponent(runId)}/revert`,
} as const
