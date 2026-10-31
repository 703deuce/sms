/**
 * G1c: what tracks do to their items at render time. Mirror: worker clips_worker/track_render.py.
 * Runs right after applyTrackState in applyTimelineLaneState, so the preview (renderEdits) and the
 * export see the same derived edits.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { isIdentitySpec, type ColorSpec } from '@/lib/clips/editor/color'
import { isOverlayFxKey } from '@/lib/clips/editor/track-fx'
import { applyTakes } from '@/lib/clips/editor/takes'
import { applyTrackMotion } from '@/lib/clips/editor/track-motion'
import { effectiveTracks, trackIdOf } from '@/lib/clips/editor/tracks'

/** Overlay-track looks → color.broll[id] for items on the track without a look of their own. */
export function applyTrackColor(edits: ClipEditsV2): ClipEditsV2 {
  const fxs = (edits.trackFx ?? []).filter((f) => isOverlayFxKey(f.track) && f.color && !f.bypass && !isIdentitySpec(f.color))
  if (!fxs.length || !edits.broll?.length) return edits
  const by = new Map<string, ColorSpec>(fxs.map((f) => [f.track, f.color!]))
  const own = edits.color?.broll ?? {}
  const tracks = effectiveTracks(edits)
  let br: Record<string, ColorSpec> | null = null
  for (const b of edits.broll) {
    if (own[b.id]) continue
    const spec = by.get(trackIdOf(edits, 'overlay', b.id, tracks))
    if (!spec) continue
    br = br ?? { ...own }
    br[b.id] = spec
  }
  return br ? { ...edits, color: { ...(edits.color ?? {}), broll: br } } : edits
}

export function applyTrackRender(edits: ClipEditsV2): ClipEditsV2 {
  // Takes first (inactive B-roll takes never render), then track color, then track motion.
  return applyTrackMotion(applyTrackColor(applyTakes(edits)))
}
