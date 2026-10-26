export function friendlyUploadError(err: unknown, httpStatus?: number): string {
  const status = httpStatus ?? extractHttpStatus(err)
  if (status === 410) {
    return 'This upload used an old server-staging path that is no longer available. Click Retry — your browser will resume directly to storage.'
  }
  if (status === 413) {
    return 'Storage rejected the file size (HTTP 413). Try a smaller file or paste a VOD link instead.'
  }
  if (status === 401 || status === 403) {
    return 'Upload not authorized. Refresh the page and try again.'
  }
  if (status && status >= 500) {
    return `Upload server error (${status}). Retry will resume from parts already stored.`
  }
  const msg = err instanceof Error ? err.message : String(err ?? 'Upload failed')
  if (/exceeded the maximum allowed size|object exceeded|maximum allowed size/i.test(msg)) {
    return 'Object storage rejected this file size (bucket limit). Raise the bucket limit, use S3 storage, or paste a VOD link instead.'
  }
  if (/Incomplete upload/i.test(msg)) {
    return `${msg} Click Retry to resume — completed parts are kept in storage.`
  }
  if (/Chunk offset mismatch|server chunk staging|Server chunk staging/i.test(msg)) {
    return 'Upload was interrupted (often during a deploy). Click Retry to resume directly to storage.'
  }
  if (/413|payload too large|too large/i.test(msg)) {
    return 'File is too large for storage. Try a smaller file or paste a VOD link instead.'
  }
  if (/network|failed to fetch|load failed/i.test(msg)) {
    return 'Network error during upload. Check your connection and click Retry to resume.'
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
