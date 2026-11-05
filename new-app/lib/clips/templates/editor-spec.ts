import type { ClipEditsV2 } from '@/lib/clips/edits'
import { isLandscapeAspect } from '@/lib/clips/export-aspect'
import { t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { resolveTemplateGeometryById, type TemplateSpecV2 } from '@/lib/clips/templates/geometry'
import { autoTemplateSegments, sceneSignals, segmentAt } from '@/lib/clips/templates/scenes'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'

/**
 * T6.5: the ONE editor-side template spec. PreviewStage (main 9:16 preview) and the layout
 * studio's small 9:16 preview both render <TemplateStage spec={editorTemplateSpec(...)}> so the
 * panel rects (incl. the geometry.ts face cover) can never disagree.
 */
export function editorTemplateSpec(
  edits: ClipEditsV2,
  aiMeta: Record<string, unknown> | null | undefined,
  /** T6.7: playhead on the source timeline (ms, like trim.in) -> that scene segment's template. */
  sourceMs?: number,
): TemplateSpecV2 | null {
  if (!t6TemplatesEnabled()) return null
  const tid = edits.layout?.template?.id
  if (!tid) return null
  // I2's portrait bands squeeze landscape footage into a 32%-height strip.
  // On landscape use the ordinary fit/blur presentation instead of portrait template geometry.
  if (tid === 'I2' && isLandscapeAspect(edits.aspectRatio)) return null
  const signals = signalsOrDefaults(aiMeta ?? null)
  const segs = sourceMs == null ? null : autoTemplateSegments(edits, signals)
  if (segs && signals.scenes) {
    const sg = segmentAt(segs, segmentTimeSec(edits, sourceMs ?? 0))
    const scene = signals.scenes[sg.scene]
    if (scene) {
      // Parity with t6_scenes.scene_spec_for_segment: the scene's signals, no stale facecam/cropBox.
      const { facecam: _fc, cropBox: _cb, ...layoutRest } = edits.layout
      void _fc
      void _cb
      const segEdits = {
        ...edits,
        layout: { ...layoutRest, template: { id: sg.id, auto: true, lane: sg.lane as never } },
      } as ClipEditsV2
      return resolveTemplateGeometryById(sg.id, sceneSignals(signals, scene), segEdits)
    }
  }
  return resolveTemplateGeometryById(tid, signals, edits)
}

/** T6.7: index of the scene segment under `sourceTimeSec` (-1 = one template for the clip). */
export function editorTemplateSegmentIndex(
  edits: ClipEditsV2,
  aiMeta: Record<string, unknown> | null | undefined,
  sourceMs: number,
): number {
  const segs = autoTemplateSegments(edits, signalsOrDefaults(aiMeta ?? null))
  if (!segs) return -1
  return segs.indexOf(segmentAt(segs, segmentTimeSec(edits, sourceMs)))
}

function segmentTimeSec(edits: ClipEditsV2, sourceMs: number): number {
  const base = edits.layout?.template?.segmentsBaseMs ?? edits.trim?.in ?? 0
  return (sourceMs - base) / 1000
}
