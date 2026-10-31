/**
 * T6.7 parity with worker/clips_worker/t6_scenes.py (scene_signals, segment lookup).
 *
 * The close look returns a per-clip scene map; the worker picks one template per scene and
 * stores them in `edits.layout.template.segments` (index into `aiMeta.signals.scenes`). The
 * export renders each segment with its template; the editor preview shows the segment under
 * the playhead with the same geometry.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { T6Scene, T6Signals } from '@/lib/clips/templates/signals'

export type T6TemplateSegment = { startS: number; endS: number; id: string; lane?: string; scene: number }

const WHOLE_FRAME_LAYOUTS = new Set(['irl_world', 'no_person'])
const AI_FACECAM_CONF = 0.9

export function sceneLane(scene: T6Scene, clipType: string): string {
  switch (scene.layout) {
    case 'webcam_game':
      return 'gaming'
    case 'irl_world':
      return 'irl'
    case 'multi_cam':
      return 'podcast'
    case 'webcam_screen':
      return 'just_chatting'
    case 'full_cam_person':
      return clipType === 'podcast' ? 'podcast' : 'just_chatting'
    default:
      return ['gaming', 'irl', 'just_chatting', 'podcast'].includes(clipType) ? clipType : 'irl'
  }
}

export function sceneSignals(base: T6Signals, scene: T6Scene): T6Signals {
  const s: T6Signals = { ...base }
  s.clip_type = sceneLane(scene, String(base.clip_type || 'irl'))
  s.type_conf = Math.max(0.6, Number(base.type_conf || 0))
  if (WHOLE_FRAME_LAYOUTS.has(scene.layout)) {
    s.faces = []
    s.facecam_box = null
    s.facecam_conf = 0
    s.content_box = null
    s.person_count = scene.layout === 'no_person' ? 0 : Number(base.person_count || 0)
    delete s.gameplay_box
    return s
  }
  const faces = (scene.faces ?? []).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, persist: f.persist, score: f.score }))
  s.faces = faces
  s.person_count = Math.max(faces.length, Number(scene.n_cams || 0))
  s.facecam_box = scene.facecam_box ?? null
  s.facecam_conf = scene.facecam_box ? AI_FACECAM_CONF : 0
  s.content_box = scene.content_box ?? null
  if (!scene.facecam_box) delete s.gameplay_box
  return s
}

/** Valid auto segments (same guard as edits_render._t6_scene_parts), else null. */
export function autoTemplateSegments(edits: ClipEditsV2, signals: T6Signals): T6TemplateSegment[] | null {
  const tmpl = edits.layout?.template
  const segs = tmpl?.segments
  if (!tmpl || !Array.isArray(segs) || segs.length < 2) return null
  if (tmpl.boxes || tmpl.auto === false) return null
  if (!Array.isArray(signals.scenes) || !signals.scenes.length) return null
  return segs
}

/** The segment under source-clip time `tSec` (seconds from the clip start). */
export function segmentAt(segs: T6TemplateSegment[], tSec: number): T6TemplateSegment {
  for (const sg of segs) if (tSec >= sg.startS && tSec < sg.endS) return sg
  return tSec < segs[0].startS ? segs[0] : segs[segs.length - 1]
}
