import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import type { EdlSegment, ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

/** Output-time clip for overlay lanes (M9). Positions derived from anchor word + EDL at render time. */
export type TimelineOverlayClip = {
  id: string
  label: string
  outStartMs: number
  outEndMs: number
  layer: number
}

export type TimelineMusicClip = {
  id: string
  label: string
  outStartMs: number
  outEndMs: number
}

export type TimelineSceneMarker = {
  sceneId: string
  label: string
  outStartMs: number
}

/** Placeholder layout until M7–M10 wire document fields into EDL-derived positions. */
export function overlayClipsForTimeline(document: ScriptDocumentV1): TimelineOverlayClip[] {
  const overlays = document.overlays ?? []
  return overlays.map((o) => ({
    id: o.id,
    label: o.label ?? 'Overlay',
    outStartMs: o.outStartMs ?? 0,
    outEndMs: (o.outStartMs ?? 0) + Math.max(1, o.durMs),
    layer: o.layer ?? 0,
  }))
}

export function musicClipsForTimeline(document: ScriptDocumentV1): TimelineMusicClip[] {
  const tracks = document.musicTracks ?? []
  return tracks.map((t) => ({
    id: t.id,
    label: t.label ?? 'Music',
    outStartMs: t.outStartMs,
    outEndMs: t.outStartMs + Math.max(1, t.durMs),
  }))
}

export function sceneMarkersForTimeline(
  document: ScriptDocumentV1,
  orderedWords: EditorWord[],
  edl: EdlSegment[],
): TimelineSceneMarker[] {
  const scenes = document.scenes ?? []
  const wordById = new Map(orderedWords.map((w) => [w.id, w]))
  return scenes.map((s, i) => {
    const w = s.startWordId ? wordById.get(s.startWordId) : orderedWords[0]
    const out = w ? (sourceMsToOutputTime(w.t0Ms, edl) ?? s.outStartMs ?? 0) : (s.outStartMs ?? 0)
    return {
      sceneId: s.id,
      label: s.label ?? `Scene ${i + 1}`,
      outStartMs: out,
    }
  })
}
