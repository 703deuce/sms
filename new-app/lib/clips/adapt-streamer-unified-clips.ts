/**
 * Maps stream (Twitch/Kick) project clip lists onto the unified results grid.
 * Ingest APIs and backend contracts are unchanged. StreamerVodRow is project-level
 * (no score / type / preview), so clips are loaded with the existing
 * listProjectClips / list-project-clips payload and adapted the same way as
 * /app/clips. Missing until #1138 lands: posted `type` on every row (inferred
 * today). Preview/download URLs still come from the existing clip media routes.
 */
import {
  adaptListProjectClips,
  type UnifiedClipResult,
} from './unified-clip-results'

export function adaptStreamerClipsForUnifiedGrid(raw: unknown): UnifiedClipResult[] {
  return adaptListProjectClips(raw)
}

export function streamerUnifiedGridStatus(opts: {
  clipCount: number
  processing: boolean
  failed: boolean
}): 'loading' | 'ready' | 'empty' | 'error' {
  if (opts.processing && opts.clipCount === 0) return 'loading'
  if (opts.failed && opts.clipCount === 0 && !opts.processing) return 'error'
  if (opts.clipCount === 0) return 'empty'
  return 'ready'
}
