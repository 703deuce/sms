/**
 * KF-16: polyline through x/y keyframe values in layer space (independent interpolation — web overlay only).
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { findTrack, keyframeTimes, layerTransformAt, type KeyframeTarget } from '@/lib/clips/editor/keyframes'

export type MotionPathPoint = { localMs: number; xPct: number; yPct: number }

export function motionPathPoints(edits: ClipEditsV2, target: KeyframeTarget): MotionPathPoint[] {
  const times = new Set<number>()
  for (const p of ['x', 'y'] as const) {
    const tr = findTrack(edits, target, p)
    for (const pt of tr?.points ?? []) times.add(pt.tMs)
  }
  return [...times]
    .sort((a, b) => a - b)
    .map((localMs) => {
      const t = layerTransformAt(edits, target, localMs)
      return { localMs, xPct: t.x, yPct: t.y }
    })
}

/** Map layer-local keyframe offsets to normalized [0,1] coords inside the preview box (center origin). */
export function motionPathScreenPoints(pts: MotionPathPoint[]): { x: number; y: number }[] {
  return pts.map((p) => ({ x: 0.5 + p.xPct / 100, y: 0.5 + p.yPct / 100 }))
}

export function motionPathVisible(edits: ClipEditsV2, target: KeyframeTarget | null): boolean {
  if (!target || target === 'captions' || target === 'voice' || target === 'music' || target.startsWith('sfx:')) return false
  return motionPathPoints(edits, target).length >= 2
}
