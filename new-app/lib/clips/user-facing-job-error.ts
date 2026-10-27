const INTERNAL_MARKERS = [
  'on conflict',
  'unique or exclusion constraint',
  'psycopg2',
  'prisma',
  'syntax error at',
  'undefined column',
  'undefined table',
  'deadlock detected',
]

export const CLIP_PROCESSING_FAILED_USER_MESSAGE = 'Processing failed. Retry processing.'

export function isInternalProcessingError(message: string): boolean {
  const lower = message.toLowerCase()
  return INTERNAL_MARKERS.some((m) => lower.includes(m))
}

/** Safe text for clip_projects.error and UI; log the raw string separately. */
export function sanitizeClipProjectErrorForUser(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (isInternalProcessingError(trimmed)) return CLIP_PROCESSING_FAILED_USER_MESSAGE
  return trimmed
}
