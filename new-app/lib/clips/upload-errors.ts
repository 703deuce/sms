export function friendlyUploadError(err: unknown, httpStatus?: number): string {
  const status = httpStatus ?? extractHttpStatus(err)
  if (status === 413) {
    return 'File is too large for storage (HTTP 413). Try a smaller file or paste a VOD link instead.'
  }
  if (status === 401 || status === 403) {
    return 'Upload not authorized. Refresh the page and try again.'
  }
  if (status && status >= 500) {
    return `Upload server error (${status}). Try again in a moment.`
  }
  const msg = err instanceof Error ? err.message : String(err ?? 'Upload failed')
  if (/413|payload too large|too large/i.test(msg)) {
    return 'File is too large for storage. Try a smaller file or paste a VOD link instead.'
  }
  if (/network|failed to fetch|load failed/i.test(msg)) {
    return 'Network error during upload. Check your connection and retry.'
  }
  return msg.length > 200 ? `${msg.slice(0, 197)}…` : msg
}

function extractHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const o = err as { status?: number; originalResponse?: { getStatus?: () => number } }
  if (typeof o.status === 'number') return o.status
  if (o.originalResponse?.getStatus) {
    try {
      return o.originalResponse.getStatus()
    } catch {
      return undefined
    }
  }
  return undefined
}
