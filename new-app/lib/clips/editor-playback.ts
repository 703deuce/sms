import type { ClipEditsV2 } from '@/lib/clips/edits'
import { keepSegments, outputDurationMs, remapTime } from '@/lib/clips/edits'
import type { CropShot } from '@/lib/server/clips/clip-detail'

export type CropTransform = { scale: number; translateX: number; translateY: number }

export function sourceMsFromVideo(videoTimeSec: number): number {
  return videoTimeSec * 1000
}

export function applyPlaybackTime(
  sourceMs: number,
  edits: ClipEditsV2,
): { sourceMs: number; outputMs: number; atEnd: boolean } {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  for (const [s, e] of edits.cutRanges) {
    if (sourceMs >= s && sourceMs < e) return { sourceMs: e, outputMs: remapTime(e, keepSegments(trimIn, trimOut, edits.cutRanges)) ?? 0, atEnd: false }
  }
  if (sourceMs < trimIn) return { sourceMs: trimIn, outputMs: 0, atEnd: false }
  if (sourceMs >= trimOut) return { sourceMs: trimOut, outputMs: outputDurationMs(edits), atEnd: true }
  const out = remapTime(sourceMs, keepSegments(trimIn, trimOut, edits.cutRanges))
  return { sourceMs, outputMs: out ?? 0, atEnd: false }
}

export function outputDurationFromEdits(edits: ClipEditsV2): number {
  return outputDurationMs(edits)
}

/** Map output timeline ms → source ms (for playhead layout edits). */
export function sourceMsAtOutput(edits: ClipEditsV2, outputMs: number): number {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  let acc = 0
  for (const [a, b] of segs) {
    const len = b - a
    if (acc + len >= outputMs) return a + (outputMs - acc)
    acc += len
  }
  return edits.trim.out
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function shotCropAt(shots: CropShot[], sourceMs: number, overrides: ClipEditsV2['layout']['shotOverrides']): CropShot {
  const i = shots.findIndex((s) => sourceMs >= s.startMs && sourceMs < s.endMs)
  const shot = i >= 0 ? shots[i] : shots[shots.length - 1]
  const focus = overrides.find((o) => o.i === i)?.focus ?? 'auto'
  if (focus === 'B') return { ...shot, cx: 70, speaker: 'B' }
  if (focus === 'A') return { ...shot, cx: 30, speaker: 'A' }
  if (focus === 'both') return { ...shot, cx: 50, scale: 1 }
  return shot
}

/** Pixel transform for 9:16 stage; video is full source frame (object-contain width). */
export function cropTransformForFrame(
  shot: CropShot,
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
): CropTransform {
  const zoom = shot.scale ?? 1.15
  const displayH = containerH
  const displayW = videoW > 0 && videoH > 0 ? (videoW / videoH) * displayH : containerW
  const scale = (displayH / Math.max(videoH, 1)) * zoom
  const cropX = (shot.cx / 100) * Math.max(videoW, 1)
  const cropY = (shot.cy / 100) * Math.max(videoH, 1)
  const translateX = -(cropX * scale) + containerW / 2 - (displayW * scale) / 2
  const translateY = -(cropY * scale) + containerH / 2 - (displayH * scale) / 2
  return { scale, translateX, translateY }
}

export function interpolateShot(shots: CropShot[], sourceMs: number, overrides: ClipEditsV2['layout']['shotOverrides']): CropShot {
  const i = shots.findIndex((s) => sourceMs >= s.startMs && sourceMs < s.endMs)
  if (i < 0) return shotCropAt(shots, sourceMs, overrides)
  const cur = shotCropAt(shots, sourceMs, overrides)
  const next = shots[i + 1]
  if (!next) return cur
  const blend = Math.min(1, Math.max(0, (sourceMs - (next.startMs - 200)) / 200))
  if (blend <= 0) return cur
  const n = shotCropAt(shots, next.startMs, overrides)
  return {
    ...cur,
    cx: lerp(cur.cx, n.cx, blend),
    cy: lerp(cur.cy, n.cy, blend),
    scale: lerp(cur.scale ?? 1.15, n.scale ?? 1.15, blend),
  }
}
