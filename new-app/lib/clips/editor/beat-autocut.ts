import type { BrollItem } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { canonicalEditsJson } from '@/lib/clips/edits'
import type { VideoLaneSeg } from '@/lib/clips/editor/clip-timeline'
import { outputToSource, type Timebase } from '@/lib/clips/editor/clip-timeline'

export function beatGrid(beatsMs: number[], every: 1 | 2 | 4, fromMs: number): number[] {
  if (!beatsMs.length) return []
  const sorted = [...beatsMs].sort((a, b) => a - b)
  let startIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < sorted.length; i++) {
    const d = Math.abs(sorted[i]! - fromMs)
    if (d < bestDist) {
      bestDist = d
      startIdx = i
    }
  }
  const out: number[] = []
  for (let i = startIdx; i < sorted.length; i += every) out.push(sorted[i]!)
  return out
}

export type AutoCutOverlayResult = {
  items: { id: string; startMs: number; endMs: number }[]
  skipped: string[]
}

export function autoCutOverlays(
  items: Pick<BrollItem, 'id' | 'startMs' | 'endMs' | 'inMs' | 'still'>[],
  beatsMs: number[],
  every: 1 | 2 | 4,
  mediaLenMs: (id: string, inMs: number) => number | null,
): AutoCutOverlayResult {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs)
  if (!sorted.length || !beatsMs.length) return { items: sorted.map((i) => ({ id: i.id, startMs: i.startMs, endMs: i.endMs })), skipped: [] }
  const from = sorted[0]!.startMs
  const grid = beatGrid(beatsMs, every, from)
  const out: AutoCutOverlayResult['items'] = []
  const skipped: string[] = []
  for (let k = 0; k < sorted.length; k++) {
    const item = sorted[k]!
    const g0 = grid[k]
    const g1 = grid[k + 1]
    if (g0 == null || g1 == null) {
      out.push({ id: item.id, startMs: item.startMs, endMs: item.endMs })
      skipped.push(item.id)
      continue
    }
    let endMs = g1
    if (!item.still) {
      const inMs = item.inMs ?? 0
      const len = mediaLenMs(item.id, inMs)
      if (len != null && inMs + (endMs - g0) > len) endMs = g0 + Math.max(0, len - inMs)
    }
    out.push({ id: item.id, startMs: g0, endMs: Math.max(g0 + 100, endMs) })
  }
  return { items: out, skipped }
}

export function beatSplitsForSegment(
  segment: { startMs: number; endMs: number; srcIn: number; srcOut: number },
  beatsOutputMs: number[],
  every: 1 | 2 | 4,
  outputToSource: (outMs: number) => number,
  existingSplits: number[] = [],
): number[] {
  const grid = beatGrid(beatsOutputMs, every, segment.startMs)
  const splits = new Set(existingSplits)
  for (const beat of grid) {
    if (beat <= segment.startMs || beat >= segment.endMs) continue
    const src = Math.round(outputToSource(beat))
    if (src <= segment.srcIn + 100 || src >= segment.srcOut - 100) continue
    splits.add(src)
  }
  const merged = [...splits].sort((a, b) => a - b)
  const minGap = 100
  const out: number[] = []
  for (const s of merged) {
    if (out.length && s - out[out.length - 1]! < minGap) continue
    out.push(s)
  }
  return out
}

export type BeatCutVideoSegment = { startMs: number; endMs: number; srcIn: number; srcOut: number }

export type BeatCutVideoPick = {
  srcInMs: number
  srcOutMs: number
  startMs: number
  endMs: number
}

/** Playhead at segment start (0) matches; otherwise clamp to nearest video lane segment. */
export function resolveVideoLaneSegmentForBeatCut(
  vsegs: readonly VideoLaneSeg[],
  playheadMs: number,
  selectedVideo?: BeatCutVideoPick | null,
): BeatCutVideoSegment | null {
  if (selectedVideo) {
    return {
      startMs: selectedVideo.startMs,
      endMs: selectedVideo.endMs,
      srcIn: selectedVideo.srcInMs,
      srcOut: selectedVideo.srcOutMs,
    }
  }
  for (const v of vsegs) {
    const endMs = v.startMs + (v.b - v.a)
    if (playheadMs >= v.startMs && playheadMs < endMs) {
      return { startMs: v.startMs, endMs, srcIn: v.a, srcOut: v.b }
    }
  }
  if (!vsegs.length) return null
  let best = vsegs[0]!
  let bestDist = Infinity
  for (const v of vsegs) {
    const endMs = v.startMs + (v.b - v.a)
    const dist =
      playheadMs < v.startMs ? v.startMs - playheadMs : playheadMs >= endMs ? playheadMs - endMs + 1 : 0
    if (dist < bestDist) {
      bestDist = dist
      best = v
    }
  }
  const endMs = best.startMs + (best.b - best.a)
  return { startMs: best.startMs, endMs, srcIn: best.a, srcOut: best.b }
}

export function countBeatCutChanges(before: ClipEditsV2, after: ClipEditsV2): number {
  const prevSplits = new Set(before.videoSplits ?? [])
  let n = (after.videoSplits ?? []).filter((s) => !prevSplits.has(s)).length
  const prevBroll = new Map((before.broll ?? []).map((b) => [b.id, b]))
  for (const b of after.broll ?? []) {
    const p = prevBroll.get(b.id)
    if (p && (p.startMs !== b.startMs || p.endMs !== b.endMs)) n += 1
  }
  return n
}

export function beatCutWouldChangeEdits(before: ClipEditsV2, after: ClipEditsV2): boolean {
  return canonicalEditsJson(before) !== canonicalEditsJson(after)
}

export type BeatCutApplyResult = {
  next: ClipEditsV2
  skippedOverlays: number
  cutCount: number
  changed: boolean
}

export function applyBeatCutToEdits(input: {
  edits: ClipEditsV2
  tb: Timebase
  cutBeatsMs: number[]
  every: 1 | 2 | 4
  playheadMs: number
  brollItems: BrollItem[]
  videoSegment: BeatCutVideoSegment | null
  cutVideo: boolean
}): BeatCutApplyResult {
  let next = input.edits
  let skipped = 0
  if (input.brollItems.length) {
    const { items, skipped: sk } = autoCutOverlays(input.brollItems, input.cutBeatsMs, input.every, () => null)
    skipped += sk.length
    const byId = new Map(items.map((i) => [i.id, i]))
    next = {
      ...next,
      broll: (next.broll ?? []).map((b) => (byId.has(b.id) ? { ...b, ...byId.get(b.id)! } : b)),
    }
  }
  if (input.cutVideo && input.videoSegment) {
    const seg = input.videoSegment
    const splits = beatSplitsForSegment(
      { startMs: seg.startMs, endMs: seg.endMs, srcIn: seg.srcIn, srcOut: seg.srcOut },
      input.cutBeatsMs,
      input.every,
      (o) => outputToSource(input.tb, o),
      next.videoSplits ?? [],
    )
    next = { ...next, videoSplits: splits }
  }
  const changed = beatCutWouldChangeEdits(input.edits, next)
  const cutCount = changed ? countBeatCutChanges(input.edits, next) : 0
  return { next, skippedOverlays: skipped, cutCount, changed }
}

export type BeatCutRegisterApi = {
  cut: (every: 1 | 2 | 4) => void
  hasBeats: boolean
  beatCount: number
  bpm?: number
  analyzing: boolean
}
