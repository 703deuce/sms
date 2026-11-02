import type { FacecamLayoutState } from '@/lib/server/clips/clip-detail'
import type { ClipEditsV2 } from '@/lib/clips/edits'

export function facecamStackAvailable(opts: {
  contentType?: string | null
  facecamLayout?: FacecamLayoutState | null
}): boolean {
  const ct = (opts.contentType || '').toLowerCase()
  if (ct.includes('game') || ct.includes('gaming')) return true
  const fc = opts.facecamLayout?.facecam
  return Boolean(fc && fc.w > 0 && fc.h > 0)
}

export function twoSpeakerSplitAvailable(words: { spk?: number | null }[]): boolean {
  const speakers = new Set<number>()
  for (const w of words) {
    if (w.spk != null && Number.isFinite(w.spk)) speakers.add(w.spk)
  }
  return speakers.size >= 2
}

export function layoutModeDisabledReason(
  mode: ClipEditsV2['layout']['mode'],
  opts: {
    contentType?: string | null
    facecamLayout?: FacecamLayoutState | null
    words?: { spk?: number | null }[]
  },
): string | null {
  if (mode === 'facecam_stack' && !facecamStackAvailable(opts)) {
    return 'Needs gameplay + facecam'
  }
  if (mode === 'split' && !twoSpeakerSplitAvailable(opts.words ?? [])) {
    return 'Needs 2 speakers'
  }
  return null
}
