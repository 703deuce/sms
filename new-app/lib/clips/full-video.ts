/**
 * FV1: "Edit a full video" project type. A full-video project is a BYO project (one clip spanning
 * the whole source, no clip finding) with `settings.fullVideo = true`: a 3 h cap instead of 3 min,
 * canvas = the source's own aspect (16:9 stays 16:9), full frame, no headline / badge.
 * No migration: settings is JSON. Clip finding stays reachable ("Find clips in this video").
 */
import { clipAspectRatios } from '@/lib/clips/settings'

/** 3 hours — same ceiling as URL import (worker/clips_worker/import_url.py). */
export const FULL_VIDEO_MAX_DURATION_MS = 3 * 60 * 60 * 1000

export const FULL_VIDEO_DURATION_ERROR =
  'Full videos can be up to 3 hours. Trim the file or upload it in parts.'

export type ClipAspect = (typeof clipAspectRatios)[number]

const ASPECT_VALUE: Record<ClipAspect, number> = {
  '9:16': 9 / 16,
  '4:5': 4 / 5,
  '1:1': 1,
  '16:9': 16 / 9,
}

export function assertFullVideoUploadDuration(durationMs: number | null | undefined): void {
  if ((durationMs ?? 0) > FULL_VIDEO_MAX_DURATION_MS) {
    throw new Error(FULL_VIDEO_DURATION_ERROR)
  }
}

/** Nearest supported canvas for a source frame (log-ratio distance). Unknown size → 16:9. */
export function sourceAspectRatio(width: number | null | undefined, height: number | null | undefined): ClipAspect {
  const w = Number(width)
  const h = Number(height)
  if (!(w > 0) || !(h > 0)) return '16:9'
  const r = Math.log(w / h)
  let best: ClipAspect = '16:9'
  let bestD = Infinity
  for (const a of clipAspectRatios) {
    const d = Math.abs(Math.log(ASPECT_VALUE[a]) - r)
    if (d < bestD) {
      bestD = d
      best = a
    }
  }
  return best
}

export function isFullVideoSettings(settings: unknown): boolean {
  return Boolean(settings && typeof settings === 'object' && (settings as { fullVideo?: unknown }).fullVideo === true)
}

/** "1:02:03" / "4:05" for duration labels on the upload page. */
export function formatMediaDuration(ms: number): string {
  // Floor like the editor clock (715.74 s → 11:55, never 11:56).
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
