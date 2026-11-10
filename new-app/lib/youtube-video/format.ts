import type { YoutubeVideoRun } from './contract'

/** Informational credits only — never a dollar amount. */
export function formatCredits(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  const rounded = Number.isInteger(n) ? String(n) : String(n)
  return `${rounded} credits`
}

export function creditLabel(run: YoutubeVideoRun | null | undefined): string | null {
  return formatCredits(run?.creditEstimate)
}

export function sanitizeYoutubeVideoMessage(message: string): string {
  return message.replace(/\s*\$[\d,]+(?:\.\d+)?/g, '').replace(/\$/g, '').trim()
}

export function fallbackEditorUrl(projectId: string, clipId: string): string {
  // Prefer the #1133 video-editor route when the API omits editorUrl.
  return `/app/video-editor/${encodeURIComponent(projectId)}/edit/${encodeURIComponent(clipId)}`
}

export function statusLabel(status: string): string {
  if (status === 'queued') return 'Queued'
  if (status === 'importing') return 'Importing'
  if (status === 'running') return 'Generating'
  if (status === 'done') return 'Done'
  if (status === 'failed') return 'Failed'
  return status
}
