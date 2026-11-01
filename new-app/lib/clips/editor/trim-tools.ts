/**
 * G1b3: NLE trim tools — roll, slide and J / L (audio-only / picture-only) edges. Manual, pure.
 *
 * Main track (keep segments of the main source, `cutRanges` stored in SOURCE ms):
 *  - roll at a real cut [.., p1] | [q0, ..]: the gap [p1, q0] moves to [p1 + d, q0 + d] — the outgoing
 *    clip gets d longer, the incoming d shorter, total length unchanged. At a videoSplit boundary the
 *    split point moves. Transitions / J-L keys follow the cut via rippleAnchoredItems.
 *  - picture-only roll (Alt on a Video edge at a real cut): same roll, the SOUND boundary stays put
 *    (audio offset −d) → a J / L cut.
 *  - slide of a middle clip [a, b] between real cuts: gap1 [p1, a] → [p1 + d, a], gap2 [b, c0] →
 *    [b, c0 + d] — the clip's content is unchanged, it moves d in output time, neighbours give/take.
 * Overlay tracks (B-roll / text items touching on the same track, ≤ TOUCH_MS apart):
 *  - roll: A.end += d, B.start += d (B-roll B.inMs += d — B's content stays anchored).
 *  - slide: B moves d; a touching left neighbour's end and right neighbour's start (+ inMs) follow.
 * Item keyframes stay on their media via reconcileItemMotion (commit path).
 */
import { BROLL_MIN_MS, type BrollItem } from '@/lib/clips/broll'
import { mergeCutRanges, subtractRangeFromCuts, type ClipEditsV2, type CutRange } from '@/lib/clips/edits'
import {
  buildTimelineItems,
  findItem,
  realCutIndices,
  refLocked,
  timebaseFor,
  VIDEO_MIN_SEG_MS,
  videoLaneSegments,
  type ItemRef,
  type OpCtx,
  type TimelineItem,
} from '@/lib/clips/editor/clip-timeline'
import { setSplitEdit, splitEditAt, splitOffsets, SPLIT_MAX_MS, SPLIT_MIN_PIECE_MS, moveSplitKey } from '@/lib/clips/editor/split-edits'
import { TEXT_MIN_MS, type TextItem } from '@/lib/clips/editor/text-items'

export type TrimTool = 'select' | 'roll' | 'slide' | 'slip' | 'blade' | 'hand'
/** TC2b (TL-18): Y slip, B blade (click splits), H hand (drag scrolls). */
export const TRIM_TOOL_KEYS: Record<string, TrimTool> = { v: 'select', r: 'roll', u: 'slide', y: 'slip', b: 'blade', h: 'hand' }

/**
 * TC2b (TL-18): Slip — a B-roll clip keeps its place and length on the timeline; the media
 * window inside it moves (dragging right shows earlier media). Never before the media start.
 */
export function slipEdit(edits: ClipEditsV2, id: string, deltaMs: number): ClipEditsV2 | null {
  const list = edits.broll ?? []
  const i = list.findIndex((b) => b.id === id)
  if (i < 0) return null
  const b = list[i]!
  const inMs = Math.max(0, Math.round((b.inMs ?? 0) - deltaMs))
  if (inMs === (b.inMs ?? 0)) return null
  const next = [...list]
  next[i] = { ...b, inMs } as BrollItem
  return { ...edits, broll: next }
}
/** Overlay items closer than this (≈ one frame) count as touching for roll / slide. */
export const TOUCH_MS = 40

function moveGap(cuts: CutRange[], from: [number, number], to: [number, number]): CutRange[] {
  let c = subtractRangeFromCuts(cuts, from)
  if (to[1] - to[0] >= 1) c = mergeCutRanges([...c, [to[0], to[1]] as CutRange])
  return c
}

function applyCutsEdits(edits: ClipEditsV2, f: (c: CutRange[]) => CutRange[]): ClipEditsV2 {
  return { ...edits, cutRanges: f(edits.cutRanges) }
}

/** Committed keep structure (preview silence-trim must not fragment main-track roll / slide). */
function mainVideoCtx(ctx: OpCtx) {
  const tb = timebaseFor(ctx.edits)
  return { tb, vs: videoLaneSegments(tb, ctx.edits.videoSplits) }
}

/** Video-lane neighbours at the boundary whose RIGHT item starts at source `rightA`. */
function boundaryAt(edits: ClipEditsV2, rightA: number) {
  const tb = timebaseFor(edits)
  const vs = videoLaneSegments(tb, edits.videoSplits)
  const i = vs.findIndex((v) => v.a === rightA)
  if (i < 1) return null
  return { tb, vs, left: vs[i - 1]!, right: vs[i]!, i }
}

/**
 * Roll the main-track edit whose right Video item starts at source `rightA` by `deltaMs` (output ms;
 * + = later). `pictureOnly` keeps the sound boundary where it was (J / L). null = no-op / not allowed.
 */
export function rollMainEdit(ctx: OpCtx, rightA: number, deltaMs: number, opts: { pictureOnly?: boolean } = {}): ClipEditsV2 | null {
  if (refLocked(ctx.edits, { lane: 'video', id: `seg:${rightA}` })) return null
  const at = boundaryAt(ctx.edits, rightA)
  if (!at) return null
  const { tb, left, right } = at
  let d = Math.round(deltaMs)
  d = Math.max(d, left.a + VIDEO_MIN_SEG_MS - left.b)
  d = Math.min(d, right.b - VIDEO_MIN_SEG_MS - right.a)
  if (!d) return null
  const p1 = left.b
  const q0 = right.a
  if (q0 - p1 < 1 && q0 - p1 > -1) {
    // Split boundary inside one keep segment: move the split point (picture-only makes no sense).
    if (opts.pictureOnly) return null
    const splits = (ctx.edits.videoSplits ?? []).map((s) => (s === q0 ? q0 + d : s))
    return { ...ctx.edits, videoSplits: splits.sort((x, y) => x - y) }
  }
  if (q0 < p1) return null // section reorder boundary (blocks are not source-adjacent)
  const nextEdits = applyCutsEdits(ctx.edits, (c) => moveGap(c, [p1, q0], [p1 + d, q0 + d]))
  // Validate: same number of keep segments, same length, and the cut actually moved.
  const nt = timebaseFor(nextEdits)
  if (nt.segs.length !== tb.segs.length || Math.abs(nt.durationMs - tb.durationMs) > 1) return null
  if (!nt.segs.some(([a]) => a === q0 + d)) return null
  let out = moveSplitKey(nextEdits, q0, q0 + d, opts.pictureOnly ? -d : 0)
  if (!opts.pictureOnly && !out.splitEdits?.length) out = { ...out, splitEdits: undefined }
  return out
}

/** Slide the main-track Video item that starts at source `a` by `deltaMs` between its neighbours. */
export function slideMainClip(ctx: OpCtx, a: number, deltaMs: number): ClipEditsV2 | null {
  if (refLocked(ctx.edits, { lane: 'video', id: `seg:${a}` })) return null
  const { tb, vs } = mainVideoCtx(ctx)
  const i = vs.findIndex((v) => v.a === a)
  if (i < 1 || i >= vs.length - 1) return null
  const prev = vs[i - 1]!
  const cur = vs[i]!
  const nxt = vs[i + 1]!
  if (cur.a < prev.b || nxt.a < cur.b) return null
  const gapBefore = cur.a - prev.b
  const gapAfter = nxt.a - cur.b
  // Contiguous videoSplits (no cut gaps): move both split points together — same middle length, neighbours adjust.
  if (gapBefore === 0 && gapAfter === 0) {
    const splitSet = new Set(ctx.edits.videoSplits ?? [])
    const rightSplit = splitSet.has(cur.b) ? cur.b : nxt.a
    if (!splitSet.has(cur.a) || (!splitSet.has(cur.b) && !splitSet.has(nxt.a))) return null
    let d = Math.round(deltaMs)
    d = Math.max(d, prev.a + VIDEO_MIN_SEG_MS - prev.b)
    d = Math.min(d, prev.b - prev.a - VIDEO_MIN_SEG_MS)
    d = Math.max(d, cur.a + VIDEO_MIN_SEG_MS - prev.b)
    d = Math.min(d, nxt.b - VIDEO_MIN_SEG_MS - cur.b)
    if (!d) return null
    const moved = [...splitSet].map((s) => (s === cur.a ? cur.a + d : s === rightSplit ? rightSplit + d : s)).sort((x, y) => x - y)
    let nextEdits: ClipEditsV2 = { ...ctx.edits, videoSplits: moved }
    nextEdits = moveSplitKey(nextEdits, cur.a, cur.a + d)
    nextEdits = moveSplitKey(nextEdits, rightSplit, rightSplit + d)
    const nt = timebaseFor(nextEdits)
    if (Math.abs(nt.durationMs - tb.durationMs) > 1) return null
    return nextEdits
  }
  let d = Math.round(deltaMs)
  d = Math.min(d, cur.a - prev.b) // gap1 can't go negative
  d = Math.max(d, cur.b - nxt.a)
  d = Math.max(d, prev.a + VIDEO_MIN_SEG_MS - prev.b)
  d = Math.min(d, nxt.b - VIDEO_MIN_SEG_MS - nxt.a)
  if (!d) return null
  const nextEdits = applyCutsEdits(ctx.edits, (c) =>
    moveGap(moveGap(c, [prev.b, cur.a], [prev.b + d, cur.a]), [cur.b, nxt.a], [cur.b, nxt.a + d]),
  )
  const nt = timebaseFor(nextEdits)
  if (Math.abs(nt.durationMs - tb.durationMs) > 1) return null
  // The clip's content keeps its source range and lands d later (a closed gap merges segments).
  const ns = nt.segs.findIndex(([x, y]) => x <= cur.a && cur.b <= y)
  if (ns < 0 || Math.abs(nt.starts[ns]! + (cur.a - nt.segs[ns]![0]) - (cur.startMs + d)) > 1) return null
  return moveSplitKey(nextEdits, nxt.a, nxt.a + d)
}

/** True when slide on main video needs a middle segment with neighbours on both sides. */
export function slideMainNeedsMiddleSegment(ctx: OpCtx, ref: ItemRef): boolean {
  if (ref.lane !== 'video') return false
  const a = Number(ref.id.replace(/^seg:/, ''))
  if (!Number.isFinite(a)) return false
  const { vs } = mainVideoCtx(ctx)
  const i = vs.findIndex((v) => v.a === a)
  return i <= 0 || i >= vs.length - 1
}

// ---------------------------------------------------------------------------
// Overlay items (B-roll / text on one track)
// ---------------------------------------------------------------------------

type OvItem = TimelineItem & { lane: 'broll' | 'text' }

function trackItems(ctx: OpCtx, it: TimelineItem): OvItem[] {
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  return lanes[it.lane]
    .filter((x) => x.id !== 'hook' && (x.track ?? '') === (it.track ?? ''))
    .sort((x, y) => x.startMs - y.startMs) as OvItem[]
}

function minLen(lane: 'broll' | 'text'): number {
  return lane === 'broll' ? BROLL_MIN_MS : TEXT_MIN_MS
}

function inMsOf(edits: ClipEditsV2, it: OvItem): number {
  return it.lane === 'broll' ? (edits.broll ?? []).find((b) => b.id === it.id)?.inMs ?? 0 : 0
}

function patch(edits: ClipEditsV2, it: OvItem, p: { startMs?: number; endMs?: number; inMs?: number }): ClipEditsV2 {
  if (it.lane === 'broll') {
    return { ...edits, broll: (edits.broll ?? []).map((b) => (b.id === it.id ? ({ ...b, ...p } as BrollItem) : b)) }
  }
  const { inMs: _ignored, ...tp } = p
  return { ...edits, textItems: (edits.textItems ?? []).map((t) => (t.id === it.id ? ({ ...t, ...tp } as TextItem) : t)) }
}

function overlayRef(ctx: OpCtx, ref: ItemRef): OvItem | null {
  if (ref.lane !== 'broll' && ref.lane !== 'text') return null
  if (ref.id === 'hook' || refLocked(ctx.edits, ref)) return null
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  return (findItem(lanes, ref) as OvItem | undefined) ?? null
}

/** Roll the edit between `ref` and its touching neighbour on `edge`. */
export function rollOverlayEdit(ctx: OpCtx, ref: ItemRef, edge: 'start' | 'end', deltaMs: number): ClipEditsV2 | null {
  const it = overlayRef(ctx, ref)
  if (!it) return null
  const list = trackItems(ctx, it)
  const A = edge === 'end' ? it : list.filter((x) => x.id !== it.id && Math.abs(x.endMs - it.startMs) <= TOUCH_MS).pop()
  const B = edge === 'start' ? it : list.find((x) => x.id !== it.id && Math.abs(x.startMs - it.endMs) <= TOUCH_MS)
  if (!A || !B) return null
  const m = minLen(it.lane)
  const bIn = inMsOf(ctx.edits, B)
  let d = Math.round(deltaMs)
  d = Math.max(d, A.startMs + m - A.endMs)
  d = Math.min(d, B.endMs - m - B.startMs)
  if (B.lane === 'broll') d = Math.max(d, -bIn)
  if (!d) return null
  let next = patch(ctx.edits, A, { endMs: A.endMs + d })
  next = patch(next, B, B.lane === 'broll' ? { startMs: B.startMs + d, inMs: bIn + d } : { startMs: B.startMs + d })
  return next
}

/** Slide an overlay item; touching neighbours on its track give / take the time. */
export function slideOverlayItem(ctx: OpCtx, ref: ItemRef, deltaMs: number): ClipEditsV2 | null {
  const it = overlayRef(ctx, ref)
  if (!it) return null
  const dur = timebaseFor(ctx.previewEdits).durationMs
  const list = trackItems(ctx, it)
  const A = list.filter((x) => x.id !== it.id && Math.abs(x.endMs - it.startMs) <= TOUCH_MS).pop()
  const C = list.find((x) => x.id !== it.id && Math.abs(x.startMs - it.endMs) <= TOUCH_MS)
  const m = minLen(it.lane)
  let d = Math.round(deltaMs)
  if (A) d = Math.max(d, A.startMs + m - A.endMs)
  else d = Math.max(d, -it.startMs)
  if (C) {
    d = Math.min(d, C.endMs - m - C.startMs)
    if (C.lane === 'broll') d = Math.max(d, -inMsOf(ctx.edits, C))
  } else d = Math.min(d, dur - it.endMs)
  if (!d) return null
  let next = patch(ctx.edits, it, { startMs: it.startMs + d, endMs: it.endMs + d })
  if (A) next = patch(next, A, { endMs: A.endMs + d })
  if (C) next = patch(next, C, C.lane === 'broll' ? { startMs: C.startMs + d, inMs: inMsOf(ctx.edits, C) + d } : { startMs: C.startMs + d })
  return next
}

// ---------------------------------------------------------------------------
// Dispatch (timeline gestures)
// ---------------------------------------------------------------------------

/** Roll tool on an item edge. */
export function rollEdit(ctx: OpCtx, ref: ItemRef, edge: 'start' | 'end', deltaMs: number): ClipEditsV2 | null {
  if (ref.lane === 'video') {
    const right = rightAOf(ctx, ref, edge)
    return right == null ? null : rollMainEdit(ctx, right, deltaMs)
  }
  return rollOverlayEdit(ctx, ref, edge, deltaMs)
}

/** Slide tool on an item body. */
export function slideEdit(ctx: OpCtx, ref: ItemRef, deltaMs: number): ClipEditsV2 | null {
  if (ref.lane === 'video') {
    const a = Number(ref.id.replace(/^seg:/, ''))
    return Number.isFinite(a) ? slideMainClip(ctx, a, deltaMs) : null
  }
  return slideOverlayItem(ctx, ref, deltaMs)
}

function rightAOf(ctx: OpCtx, ref: ItemRef, edge: 'start' | 'end'): number | null {
  const { vs } = mainVideoCtx(ctx)
  const i = vs.findIndex((v) => `seg:${v.a}` === ref.id)
  if (i < 0) return null
  const j = edge === 'start' ? i : i + 1
  return j >= 1 && j < vs.length ? vs[j]!.a : null
}

/** Source ms + picture output ms for a J / L boundary on the Voice lane. */
function voiceJlBoundary(ctx: OpCtx, ref: ItemRef, edge: 'start' | 'end'): { atMs: number; picMs: number } | null {
  const tb = timebaseFor(ctx.edits)
  const vsegs = videoLaneSegments(tb, ctx.edits.videoSplits)
  const i = vsegs.findIndex((v) => `voice:${v.a}` === ref.id)
  if (i < 0) return null
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  const it = findItem(lanes, ref)
  if (!it) return null
  if (edge === 'start') {
    if (i < 1) return null
    const atMs = vsegs[i]!.a
    return { atMs, picMs: it.startMs }
  }
  if (i >= vsegs.length - 1) {
    const ki = tb.segs.findIndex(([a, b]) => a <= vsegs[i]!.a && vsegs[i]!.b <= b)
    const k = ki + 1
    if (ki < 0 || !realCutIndices(tb).includes(k)) return null
    return { atMs: tb.segs[k]![0], picMs: it.endMs }
  }
  const atMs = vsegs[i + 1]!.a
  return { atMs, picMs: it.endMs }
}

function clampJlAudioMs(ctx: OpCtx, atMs: number, audioMs: number): number {
  const tb = timebaseFor(ctx.edits)
  const vsegs = videoLaneSegments(tb, ctx.edits.videoSplits)
  const right = vsegs.find((v) => v.a === atMs)
  const left = vsegs.find((v) => v.b === atMs)
  if (!left || !right) {
    const k = tb.segs.findIndex(([a]) => a === atMs)
    if (k < 1) return 0
    const [p0, p1] = tb.segs[k - 1]!
    const [q0, q1] = tb.segs[k]!
    const lim = Math.floor((Math.min(p1 - p0, q1 - q0) - SPLIT_MIN_PIECE_MS) / 2)
    if (lim <= 0) return 0
    let v = Math.max(-lim, Math.min(lim, Math.round(audioMs)))
    if (v > 0) v = Math.min(v, Math.max(0, ctx.edits.trim.out - p1))
    else v = Math.max(v, -Math.max(0, q0 - ctx.edits.trim.in))
    return v
  }
  const lim = Math.floor((Math.min(left.b - left.a, right.b - right.a) - SPLIT_MIN_PIECE_MS) / 2)
  if (lim <= 0) return 0
  return Math.max(-lim, Math.min(lim, Math.round(audioMs)))
}

export function splitEdgeTrim(ctx: OpCtx, ref: ItemRef, edge: 'start' | 'end', toMs: number): ClipEditsV2 | null {
  if (refLocked(ctx.edits, ref)) return null
  const tb = timebaseFor(ctx.edits)
  if (ref.lane === 'voice') {
    const b = voiceJlBoundary(ctx, ref, edge)
    if (!b) return null
    const v = clampJlAudioMs(ctx, b.atMs, Math.round(toMs - b.picMs) + splitEditAt(ctx.edits, b.atMs))
    if (v === splitEditAt(ctx.edits, b.atMs)) return null
    return setSplitEdit(ctx.edits, b.atMs, v)
  }
  if (ref.lane === 'video') {
    const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
    const it = findItem(lanes, ref)
    const right = rightAOf(ctx, ref, edge)
    if (!it || right == null) return null
    const splits = new Set(ctx.edits.videoSplits ?? [])
    const isVideoSplit = splits.has(right)
    const k = tb.segs.findIndex(([a]) => a === right)
    const isRealCut = k >= 1 && realCutIndices(tb).includes(k)
    if (!isRealCut && !isVideoSplit) return null
    return rollMainEdit(ctx, right, toMs - (edge === 'start' ? it.startMs : it.endMs), { pictureOnly: true })
  }
  return null
}

export const DEFAULT_JL_CUT_MS = 500

/**
 * Apply a J- or L-cut at a main-track boundary (source ms where the right segment starts).
 * Uses the same model as Alt-drag on Voice edges at the cut.
 */
export function applyJLCutAt(ctx: OpCtx, atSrcMs: number, kind: 'j' | 'l', ms = DEFAULT_JL_CUT_MS): ClipEditsV2 | null {
  const tb = timebaseFor(ctx.edits)
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  const vsegs = videoLaneSegments(tb, ctx.edits.videoSplits)
  const k = vsegs.findIndex((v) => Math.abs(v.a - atSrcMs) <= 1)
  if (k < 1) return null
  const voiceLeft = lanes.voice[k - 1]
  const voiceRight = lanes.voice[k]
  if (!voiceLeft || !voiceRight) return null
  if (kind === 'l') {
    return splitEdgeTrim(ctx, { lane: 'voice', id: voiceLeft.id }, 'end', voiceLeft.endMs + ms)
  }
  return splitEdgeTrim(ctx, { lane: 'voice', id: voiceRight.id }, 'start', voiceRight.startMs - ms)
}
