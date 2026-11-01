/**
 * KF-12: burned-caption motion from keyframes target `captions` (output ms).
 * Offsets are % of play area; scale is % (100 = preset size). Preview + export share this math.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { findTrack, trackValueAt } from '@/lib/clips/editor/keyframes'

export type CaptionMotion = { xPct: number; yPct: number; scalePct: number }

export function captionMotionAt(edits: ClipEditsV2, outputMs: number): CaptionMotion {
  const t = Math.max(0, outputMs)
  const v = (p: 'capX' | 'capY' | 'capScale') => trackValueAt(findTrack(edits, 'captions', p), p, t)
  return { xPct: v('capX'), yPct: v('capY'), scalePct: v('capScale') }
}

/** True when any caption motion keyframes exist (or static track values). */
export function captionsMotionActive(edits: ClipEditsV2): boolean {
  for (const p of ['capX', 'capY', 'capScale'] as const) {
    const tr = findTrack(edits, 'captions', p)
    if (tr?.points.length) return true
    if (tr?.value != null && tr.value !== (p === 'capScale' ? 100 : 0)) return true
  }
  return false
}

/** ASS override tags for one dialogue line (empty when at defaults). */
export function captionAssMotionTags(m: CaptionMotion, playW: number, playH: number, align: number, marginV: number): string {
  if (m.xPct === 0 && m.yPct === 0 && m.scalePct === 100) return ''
  const dx = (m.xPct / 100) * playW
  const dy = -(m.yPct / 100) * playH
  const cx = Math.round(playW / 2 + dx)
  let cy: number
  if (align === 8) cy = Math.round(dy + playH * 0.12)
  else if (align === 5) cy = Math.round(playH / 2 + dy)
  else cy = Math.round(playH - marginV + dy)
  const sc = Math.round(Math.max(50, Math.min(200, m.scalePct)))
  return `{\\an${align}\\pos(${cx},${cy})\\fscx${sc}\\fscy${sc}}`
}
