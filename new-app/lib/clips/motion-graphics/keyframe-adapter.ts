/**
 * Convert motion-plan item-local spatial keyframes into the existing editor
 * keyframe tracks. One group is replicated to each independently rendered
 * text/shape child, preserving synchronized chart/diagram animation.
 */
import type { KeyframeTrack, KeyProp } from '@/lib/clips/editor/motion-schema'
import type { MotionGraphic } from './contract'

type VisualProp = 'x' | 'y' | 'scale' | 'rotation' | 'opacity'
const DEFAULTS: Record<VisualProp, number> = {
  x: 0, y: 0, scale: 100, rotation: 0, opacity: 100,
}
const PROPS: VisualProp[] = ['x', 'y', 'scale', 'rotation', 'opacity']

function valueFor(g: MotionGraphic, prop: VisualProp, raw: number): number {
  if (prop === 'x') return (raw - (g.box.x + g.box.width / 2)) * 100
  if (prop === 'y') return (raw - (g.box.y + g.box.height / 2)) * 100
  if (prop === 'scale') return raw * 100
  if (prop === 'opacity') return raw * 100
  return raw
}

export function motionKeyframeTracks(g: MotionGraphic, ids: readonly string[]): KeyframeTrack[] {
  const tracks: KeyframeTrack[] = []
  for (const prop of PROPS) {
    const points = g.keyframes.flatMap(frame => {
      const raw = frame[prop]
      if (raw === undefined) return []
      const v = valueFor(g, prop, raw)
      if (!Number.isFinite(v)) return []
      if ((prop === 'scale' && (v < 10 || v > 400)) ||
          ((prop === 'x' || prop === 'y') && (v < -100 || v > 100)))
        throw new Error('motion_keyframe_outside_editor_range')
      return [{ tMs: frame.atMs, v }]
    })
    if (!points.length) continue
    for (const id of ids) {
      tracks.push({
        target: `text:${id}`, prop: prop as KeyProp, value: DEFAULTS[prop],
        points,
      })
    }
  }
  return tracks
}
