/** Editor matte status: orphaned preview jobs must not block retry forever. */
export const MATTE_PREVIEW_MAX_AGE_MS = 8 * 60 * 1000
export function matteJobTimedOut(status: string, createdAt: Date, now = Date.now()): boolean {
  return (status === 'QUEUED' || status === 'RUNNING') && now - createdAt.getTime() > MATTE_PREVIEW_MAX_AGE_MS
}

