import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  normalizeEditSpeed,
  normalizeSectionOrder,
  orderedKeepSegments,
  outputDurationMs,
  remapTime,
} from '@/lib/clips/edits'
import type { CropShot } from '@/lib/server/clips/clip-detail'

export type CropTransform = { scale: number; translateX: number; translateY: number }

export function sourceMsFromVideo(videoTimeSec: number, mediaOffsetMs = 0): number {
  return videoTimeSec * 1000 + mediaOffsetMs
}

export function videoTimeFromSourceMs(sourceMs: number, mediaOffsetMs = 0): number {
  return Math.max(0, (sourceMs - mediaOffsetMs) / 1000)
}

export function applyPlaybackTime(
  sourceMs: number,
  edits: ClipEditsV2,
): { sourceMs: number; outputMs: number; atEnd: boolean } {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const segs = orderedKeepSegments(edits)
  const inCut = edits.cutRanges.some(([s, e]) => sourceMs >= s && sourceMs < e)
  if (inCut) {
    const cut = edits.cutRanges.find(([s, e]) => sourceMs >= s && sourceMs < e)!
    const cutEnd = cut[1]
    const nextSeg = segs.find(([a, b]) => a >= cutEnd && b - a >= 80)
    if (!nextSeg) {
      return { sourceMs: trimOut, outputMs: outputDurationMs(edits), atEnd: true }
    }
    return {
      sourceMs: nextSeg[0],
      outputMs: remapTime(nextSeg[0], segs) ?? 0,
      atEnd: false,
    }
  }
  if (sourceMs < trimIn) return { sourceMs: trimIn, outputMs: 0, atEnd: false }
  const segIdx = segs.findIndex(([a, b]) => a <= sourceMs && sourceMs < b)
  if (segIdx < 0) {
    if (sourceMs >= trimOut) return { sourceMs: trimOut, outputMs: outputDurationMs(edits), atEnd: true }
    return { sourceMs: trimIn, outputMs: 0, atEnd: false }
  }
  const [, segEnd] = segs[segIdx]!
  if (sourceMs >= segEnd - 1 && segIdx < segs.length - 1) {
    const nextStart = segs[segIdx + 1]![0]
    return { sourceMs: nextStart, outputMs: remapTime(nextStart, segs) ?? 0, atEnd: false }
  }
  if (sourceMs >= trimOut || (segIdx === segs.length - 1 && sourceMs >= segEnd - 1)) {
    return { sourceMs: trimOut, outputMs: outputDurationMs(edits), atEnd: true }
  }
  const out = remapTime(sourceMs, segs)
  return { sourceMs, outputMs: out ?? 0, atEnd: false }
}

export function outputDurationFromEdits(edits: ClipEditsV2): number {
  return outputDurationMs(edits)
}

/** Map output timeline ms → source ms (for playhead layout edits). */
export function sourceMsAtOutput(edits: ClipEditsV2, outputMs: number): number {
  const segs = orderedKeepSegments(edits)
  let acc = 0
  for (const [a, b] of segs) {
    const len = b - a
    if (outputMs < acc + len) return a + (outputMs - acc)
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
