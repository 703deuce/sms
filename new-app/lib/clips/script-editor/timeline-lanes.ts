import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

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

export function sceneMarkersForTimeline(document: ScriptDocumentV1): TimelineSceneMarker[] {
  const scenes = document.scenes ?? []
  return scenes.map((s, i) => ({
    sceneId: s.id,
    label: s.label ?? `Scene ${i + 1}`,
    outStartMs: s.outStartMs ?? 0,
  }))
}
