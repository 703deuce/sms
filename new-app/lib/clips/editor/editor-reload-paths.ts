/**
 * Inventory of code paths that can reload the clip editor page (for diagnostics / tests).
 * 409 and 502 on clip PATCH do NOT reload here — see use-editor-state processSaveQueue.
 */
export const EDITOR_FULL_RELOAD_PATHS = {
  chunkLoadRecovery: 'components/chunk-load-recovery.tsx → window.location.reload on stale Next chunk/CSS',
  clipperSurfaceErrorBoundary: 'components/clips/clipper-surface-error-boundary.tsx → manual Reload page button',
  screenwritingOnly: 'components/screenwriting/* (not clip editor)',
} as const

/** Do not reload again within this window (prevents a reload loop on a real outage). */
export const CHUNK_RELOAD_COOLDOWN_MS = 60_000

export function shouldReloadForChunkError(stored: string | null, nowMs: number): boolean {
  if (!stored) return true
  const at = Number(stored)
  if (!Number.isFinite(at) || at < 1e12) return true
  return nowMs - at > CHUNK_RELOAD_COOLDOWN_MS
}

/** True only for stale Next static assets or known chunk-load errors (not API 502 HTML). */
export function shouldReloadForChunkFailure(filename: string, message: string): boolean {
  const file = filename || ''
  if (file.includes('/api/')) return false
  const staticAsset =
    file.includes('/_next/static/chunks/') ||
    file.includes('/_next/static/css/') ||
    (!file && (message.includes('ChunkLoadError') || message.includes('Loading chunk')))
  if (!staticAsset) return false
  if (message.includes('502') && !message.includes('ChunkLoadError') && !message.includes('Loading chunk')) return false
  return true
}
