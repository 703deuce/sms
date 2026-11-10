/** Informational credits only — never a dollar amount. */
export function formatCredits(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'Credits TBD'
  return `${n} credits`
}

export function sanitizeAdStudioMessage(message: string): string {
  return message.replace(/\s*\$[\d,]+(?:\.\d+)?/g, '').replace(/\$/g, '').trim()
}

export function compactEditorUrl(projectId: string, clipId: string): string {
  return `/app/video-editor/${encodeURIComponent(projectId)}/edit/${encodeURIComponent(clipId)}`
}

export function fullEditorUrl(projectId: string, clipId: string): string {
  return `/app/video-editor/${encodeURIComponent(projectId)}/edit/${encodeURIComponent(clipId)}?timeline=1`
}

export function statusLabel(status: string): string {
  if (status === 'plan_ready') return 'Plan ready'
  if (status === 'planning') return 'Planning'
  if (status === 'generating') return 'Generating'
  if (status === 'stitching') return 'Stitching'
  if (status === 'done') return 'Ready'
  if (status === 'failed') return 'Failed'
  if (status === 'cancelled') return 'Cancelled'
  return status
}
