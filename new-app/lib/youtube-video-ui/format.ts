import type { YoutubeVideoRunView, YoutubeVideoStatus } from '../youtube-video/types'

/** Informational credits only — never a dollar amount. */
export function formatCredits(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return `${n} credits`
}

export function creditLabel(run: YoutubeVideoRunView | null | undefined): string | null {
  return formatCredits(run?.creditsEstimated)
}

export function sanitizeYoutubeVideoMessage(message: string): string {
  return message.replace(/\s*\$[\d,]+(?:\.\d+)?/g, '').replace(/\$/g, '').trim()
}

export function fallbackEditorUrl(projectId: string, clipId: string): string {
  return `/app/video-editor/${encodeURIComponent(projectId)}/edit/${encodeURIComponent(clipId)}`
}

export function statusLabel(status: YoutubeVideoStatus | string): string {
  if (status === 'queued') return 'Queued'
  if (status === 'importing') return 'Importing'
  if (status === 'waiting_for_source') return 'Transcribing source'
  if (status === 'running') return 'Generating'
  if (status === 'awaiting_choice') return 'Choose a story'
  if (status === 'ready') return 'Ready'
  if (status === 'failed') return 'Failed'
  if (status === 'canceled') return 'Canceled'
  return status
}
