/**
 * E2 multi-track timeline model for the clip editor (pure, no React).
 *
 * Single time base: OUTPUT ms of `editorPreviewEdits(edits, words)` — the same
 * effective edits (silence trim + loop-friendly end + section order) the worker
 * renders. Every lane item maps 1:1 onto an existing `edits` field:
 *
 *   text  → edits.hookOverlay (0 .. durationMs)
 *   video → keep segments of the EDL (trim + cutRanges + sectionOrder)
 *   broll → edits.broll[] {startMs, endMs, inMs?}           (output ms)
 *   voice → same segments as video (waveform; mute only)
 *   music → edits.audio.music {startMs?, endMs?, inMs?}      (output ms)
 *   sfx   → edits.audio.sfx[] {atMs}                         (output ms)
 *
 * Lane mute/hide/lock lives in edits.timelineLanes and is applied for preview AND
 * export by `applyTimelineLaneState` (mirrored in worker `timeline_lanes.py`).
 */
import type { ClipAudioMusic, ClipAudioSfx } from '@/lib/clips/audio'
import { BROLL_MIN_MS, type BrollItem } from '@/lib/clips/broll'
import {
  mergeCutRanges,
  orderedKeepSegments,
  subtractRangeFromCuts,
  type ClipEditsV2,
  type CutRange,
} from '@/lib/clips/edits'
import { splitLayoutSegmentAt } from '@/lib/clips/layout-segments'
import {
  LANE_ORDER,
  LANE_TOGGLES,
  normalizeTimelineLanes,
  type LaneId,
  type LaneState,
  type TimelineLanesState,
} from '@/lib/clips/editor/timeline-lane-state'

export { LANE_ORDER, LANE_TOGGLES, normalizeTimelineLanes }
export type { LaneId, LaneState, TimelineLanesState }

export const LANE_LABELS: Record<LaneId, string> = {
  text: 'Text',
  video: 'Video',
  broll: 'B-roll',
  voice: 'Voice',
  music: 'Music',
  sfx: 'SFX',
}

export const MUSIC_MIN_MS = 500
export const SFX_DEFAULT_MS = 1000
export const HOOK_MIN_MS = 1500
export const HOOK_MAX_MS = 5000
export const VIDEO_MIN_SEG_MS = 200
/** One frame at 30 fps — arrow-key nudge step. Shift = 10 frames. */
export const NUDGE_MS = 33

export type ItemCaps = { move: boolean; trimStart: boolean; trimEnd: boolean; split: boolean; del: boolean }

export type TimelineItem = {
  lane: LaneId
  id: string
  startMs: number
  endMs: number
  label: string
  caps: ItemCaps
  /** Source range for video/voice segments. */
  srcInMs?: number
  srcOutMs?: number
  /** Media in-point (B-roll / music) — content offset at startMs. */
  inMs?: number
}

export type ItemRef = { lane: LaneId; id: string }

export const refKey = (r: ItemRef) => `${r.lane}:${r.id}`

// ---------------------------------------------------------------------------
// Time base
// ---------------------------------------------------------------------------

export type Timebase = {
  /** Source ranges in OUTPUT order. */
  segs: [number, number][]
  /** Output start of each seg. */
  starts: number[]
  durationMs: number
}

export function timebaseFor(previewEdits: ClipEditsV2): Timebase {
  const segs = orderedKeepSegments(previewEdits)
  const starts: number[] = []
  let acc = 0
  for (const [a, b] of segs) {
    starts.push(acc)
    acc += b - a
  }
  return { segs, starts, durationMs: acc }
}

/** Output ms → source ms (start-biased: a boundary maps to the next segment's start). */
export function outputToSource(tb: Timebase, outMs: number): number {
  if (!tb.segs.length) return 0
  const t = Math.max(0, outMs)
  for (let i = 0; i < tb.segs.length; i++) {
    const [a, b] = tb.segs[i]!
    if (t < tb.starts[i]! + (b - a)) return a + (t - tb.starts[i]!)
  }
  return tb.segs[tb.segs.length - 1]![1]
}

/** Output ms → source ms (end-biased: a boundary maps to the previous segment's end). */
export function outputToSourceEnd(tb: Timebase, outMs: number): number {
  if (!tb.segs.length) return 0
  const t = Math.max(0, outMs)
  for (let i = 0; i < tb.segs.length; i++) {
    const [a, b] = tb.segs[i]!
    if (t <= tb.starts[i]! + (b - a)) return a + (t - tb.starts[i]!)
  }
  return tb.segs[tb.segs.length - 1]![1]
}

/** Source ms → output ms, or null when the point is cut / outside the trim. */
export function sourceToOutput(tb: Timebase, srcMs: number): number | null {
  for (let i = 0; i < tb.segs.length; i++) {
    const [a, b] = tb.segs[i]!
    if (srcMs >= a && srcMs <= b) return tb.starts[i]! + (srcMs - a)
  }
  return null
}

/**
 * Source ms → output ms; a point inside a cut snaps to the join (output start of the
 * next kept source segment, else the end of the previous one).
 */
export function sourceToOutputSnapped(tb: Timebase, srcMs: number): number {
  const direct = sourceToOutput(tb, srcMs)
  if (direct != null) return direct
  let next: number | null = null
  let nextSrc = Infinity
  let prev: number | null = null
  let prevSrc = -Infinity
  tb.segs.forEach(([a, b], i) => {
    if (a >= srcMs && a < nextSrc) {
      nextSrc = a
      next = tb.starts[i]!
    }
    if (b <= srcMs && b > prevSrc) {
      prevSrc = b
      prev = tb.starts[i]! + (b - a)
    }
  })
  if (next != null) return next
  if (prev != null) return prev
  return 0
}

// ---------------------------------------------------------------------------
// Lane state
// ---------------------------------------------------------------------------

export function laneState(edits: ClipEditsV2, lane: LaneId): LaneState {
  return edits.timelineLanes?.[lane] ?? {}
}

export function setLaneState(edits: ClipEditsV2, lane: LaneId, patch: LaneState): ClipEditsV2 {
  const cur = { ...(edits.timelineLanes ?? {}) }
  cur[lane] = { ...(cur[lane] ?? {}), ...patch }
  return { ...edits, timelineLanes: normalizeTimelineLanes(cur) }
}

/**
 * Edits as rendered (preview + export). Hidden/muted lanes are dropped here so the
 * worker and the browser see the same thing. Voice mute is honoured by the worker
 * (`timelineLanes.voice.muted`) and by muting the preview <video>.
 */
export function applyTimelineLaneState(edits: ClipEditsV2): ClipEditsV2 {
  const lanes = normalizeTimelineLanes(edits.timelineLanes)
  if (!lanes) return edits
  let next: ClipEditsV2 = edits
  if (lanes.broll?.hidden && (edits.broll?.length ?? 0) > 0) next = { ...next, broll: [] }
  if (lanes.text?.hidden && edits.hookOverlay?.enabled) {
    next = { ...next, hookOverlay: { ...edits.hookOverlay, enabled: false } }
  }
  const audio = next.audio
  if (audio) {
    let a = audio
    if (lanes.music?.muted && a.music) a = { ...a, music: null }
    if (lanes.sfx?.muted && a.sfx.length) a = { ...a, sfx: [] }
    if (lanes.voice?.muted && a.studioSound) a = { ...a, studioSound: null }
    if (a !== audio) next = { ...next, audio: a }
  }
  if (lanes.voice?.muted && next.audioTrack) next = { ...next, audioTrack: undefined }
  return next
}

export function voiceMuted(edits: ClipEditsV2): boolean {
  return Boolean(normalizeTimelineLanes(edits.timelineLanes)?.voice?.muted)
}

// ---------------------------------------------------------------------------
// Music window
// ---------------------------------------------------------------------------

export type MusicWindow = { startMs: number; endMs: number; inMs: number }

/** Output window the music bed plays in (defaults: whole clip from media 0). */
export function musicWindow(music: ClipAudioMusic | null | undefined, durationMs: number): MusicWindow | null {
  if (!music) return null
  const dur = Math.max(0, durationMs)
  const startMs = clamp(Math.round(music.startMs ?? 0), 0, Math.max(0, dur - MUSIC_MIN_MS))
  const rawEnd = music.endMs == null ? dur : Math.round(music.endMs)
  const endMs = clamp(rawEnd, Math.min(dur, startMs + MUSIC_MIN_MS), dur)
  return { startMs, endMs, inMs: Math.max(0, Math.round(music.inMs ?? 0)) }
}

// ---------------------------------------------------------------------------
// Lane items
// ---------------------------------------------------------------------------

const NO_CAPS: ItemCaps = { move: false, trimStart: false, trimEnd: false, split: false, del: false }

export function buildTimelineItems(input: {
  edits: ClipEditsV2
  previewEdits: ClipEditsV2
  sfxDurationsMs?: Record<string, number>
}): Record<LaneId, TimelineItem[]> {
  const { edits, previewEdits } = input
  const tb = timebaseFor(previewEdits)
  const dur = tb.durationMs
  const lanes: Record<LaneId, TimelineItem[]> = { text: [], video: [], broll: [], voice: [], music: [], sfx: [] }

  const ho = edits.hookOverlay
  if (ho?.enabled) {
    lanes.text.push({
      lane: 'text',
      id: 'hook',
      startMs: 0,
      endMs: Math.min(dur, clamp(ho.durationMs ?? 2500, HOOK_MIN_MS, HOOK_MAX_MS)),
      label: ho.text?.trim() || 'Hook title',
      caps: { ...NO_CAPS, trimEnd: true, del: true },
    })
  }

  const multi = tb.segs.length > 1
  tb.segs.forEach(([a, b], i) => {
    const startMs = tb.starts[i]!
    const endMs = startMs + (b - a)
    lanes.video.push({
      lane: 'video',
      id: `seg:${a}`,
      startMs,
      endMs,
      srcInMs: a,
      srcOutMs: b,
      label: `Clip ${i + 1}`,
      caps: { move: false, trimStart: true, trimEnd: true, split: true, del: multi },
    })
    lanes.voice.push({
      lane: 'voice',
      id: `voice:${a}`,
      startMs,
      endMs,
      srcInMs: a,
      srcOutMs: b,
      label: 'Voice',
      caps: NO_CAPS,
    })
  })

  for (const item of edits.broll ?? []) {
    lanes.broll.push({
      lane: 'broll',
      id: item.id,
      startMs: item.startMs,
      endMs: item.endMs,
      inMs: item.inMs ?? 0,
      label: item.source === 'ai' ? 'AI B-roll' : 'Stock B-roll',
      caps: { move: true, trimStart: true, trimEnd: true, split: true, del: true },
    })
  }

  const mw = musicWindow(edits.audio?.music, dur)
  if (mw && edits.audio?.music) {
    lanes.music.push({
      lane: 'music',
      id: edits.audio.music.generationId,
      startMs: mw.startMs,
      endMs: mw.endMs,
      inMs: mw.inMs,
      label: 'Music',
      caps: { move: true, trimStart: true, trimEnd: true, split: false, del: true },
    })
  }

  for (const s of edits.audio?.sfx ?? []) {
    const len = Math.max(100, Math.round(input.sfxDurationsMs?.[s.generationId] ?? SFX_DEFAULT_MS))
    lanes.sfx.push({
      lane: 'sfx',
      id: s.generationId,
      startMs: s.atMs,
      endMs: s.atMs + len,
      label: 'SFX',
      caps: { ...NO_CAPS, move: true, del: true },
    })
  }
  return lanes
}

export function findItem(lanes: Record<LaneId, TimelineItem[]>, ref: ItemRef): TimelineItem | undefined {
  return lanes[ref.lane].find((i) => i.id === ref.id)
}

// ---------------------------------------------------------------------------
// Snapping
// ---------------------------------------------------------------------------

/** Snap targets: playhead, cut joins, word boundaries, other items' edges, 0 and end. */
export function snapTargets(input: {
  lanes: Record<LaneId, TimelineItem[]>
  durationMs: number
  playheadMs: number
  wordEdgesMs?: number[]
  exclude?: Set<string>
}): number[] {
  const set = new Set<number>([0, Math.round(input.durationMs), Math.round(input.playheadMs)])
  for (const lane of LANE_ORDER) {
    for (const it of input.lanes[lane]) {
      if (input.exclude?.has(refKey(it))) continue
      set.add(Math.round(it.startMs))
      set.add(Math.round(it.endMs))
    }
  }
  for (const w of input.wordEdgesMs ?? []) set.add(Math.round(w))
  return [...set].sort((a, b) => a - b)
}

export function snapValue(ms: number, targets: number[], thresholdMs: number): { ms: number; snappedTo: number | null } {
  let best: number | null = null
  let bestD = Infinity
  for (const t of targets) {
    const d = Math.abs(t - ms)
    if (d <= thresholdMs && d < bestD) {
      best = t
      bestD = d
    }
  }
  return best == null ? { ms, snappedTo: null } : { ms: best, snappedTo: best }
}

/** Snap a move: whichever moving edge lands closest to a target wins. */
export function snapMoveDelta(
  edges: number[],
  deltaMs: number,
  targets: number[],
  thresholdMs: number,
): { deltaMs: number; snappedTo: number | null } {
  let best: { deltaMs: number; snappedTo: number } | null = null
  let bestD = Infinity
  for (const e of edges) {
    const s = snapValue(e + deltaMs, targets, thresholdMs)
    if (s.snappedTo == null) continue
    const d = Math.abs(s.ms - (e + deltaMs))
    if (d < bestD) {
      bestD = d
      best = { deltaMs: s.ms - e, snappedTo: s.snappedTo }
    }
  }
  return best ?? { deltaMs, snappedTo: null }
}

// ---------------------------------------------------------------------------
// Edit operations (each returns NEW edits = one undo step, or null for no-op)
// ---------------------------------------------------------------------------

export type OpCtx = {
  edits: ClipEditsV2
  previewEdits: ClipEditsV2
  /** Clamp for trim.in/out (extended AI bounds + media bounds). */
  clampTrim?: (t: { in: number; out: number }) => { in: number; out: number }
}

function lockedLanes(edits: ClipEditsV2): Set<LaneId> {
  const l = normalizeTimelineLanes(edits.timelineLanes)
  return new Set(LANE_ORDER.filter((id) => l?.[id]?.locked))
}

function patchBroll(edits: ClipEditsV2, id: string, patch: Partial<BrollItem>): ClipEditsV2 {
  return {
    ...edits,
    broll: (edits.broll ?? []).map((b) => (b.id === id ? ({ ...b, ...patch } as BrollItem) : b)),
  }
}

function patchMusic(edits: ClipEditsV2, patch: Partial<ClipAudioMusic>): ClipEditsV2 {
  const audio = edits.audio
  if (!audio?.music) return edits
  return { ...edits, audio: { ...audio, music: { ...audio.music, ...patch } } }
}

function patchSfx(edits: ClipEditsV2, id: string, patch: Partial<ClipAudioSfx>): ClipEditsV2 {
  const audio = edits.audio
  if (!audio) return edits
  return { ...edits, audio: { ...audio, sfx: audio.sfx.map((s) => (s.generationId === id ? { ...s, ...patch } : s)) } }
}

/** Move movable items by deltaMs (B-roll, music, SFX). Locked lanes are skipped. */
export function moveItems(ctx: OpCtx, refs: ItemRef[], deltaMs: number): ClipEditsV2 | null {
  const locked = lockedLanes(ctx.edits)
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  const dur = timebaseFor(ctx.previewEdits).durationMs
  const items = refs
    .filter((r) => !locked.has(r.lane))
    .map((r) => findItem(lanes, r))
    .filter((i): i is TimelineItem => Boolean(i?.caps.move))
  if (!items.length || !deltaMs) return null
  // Clamp the shared delta so every item stays inside [0, dur].
  let d = Math.round(deltaMs)
  for (const it of items) {
    const len = it.endMs - it.startMs
    if (it.lane === 'sfx') {
      d = Math.max(d, -it.startMs)
      d = Math.min(d, Math.max(0, dur - 1 - it.startMs))
    } else {
      d = Math.max(d, -it.startMs)
      d = Math.min(d, Math.max(0, dur - len - it.startMs))
    }
  }
  if (!d) return null
  let next = ctx.edits
  for (const it of items) {
    if (it.lane === 'broll') next = patchBroll(next, it.id, { startMs: it.startMs + d, endMs: it.endMs + d })
    else if (it.lane === 'music') next = patchMusic(next, { startMs: it.startMs + d, endMs: it.endMs + d })
    else if (it.lane === 'sfx') next = patchSfx(next, it.id, { atMs: it.startMs + d })
  }
  return next
}

/** Trim one edge of an item to `toMs` (output ms). */
export function trimItem(ctx: OpCtx, ref: ItemRef, edge: 'start' | 'end', toMs: number): ClipEditsV2 | null {
  if (lockedLanes(ctx.edits).has(ref.lane)) return null
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  const it = findItem(lanes, ref)
  if (!it) return null
  if (edge === 'start' ? !it.caps.trimStart : !it.caps.trimEnd) return null
  const tb = timebaseFor(ctx.previewEdits)
  const dur = tb.durationMs
  const to = Math.round(toMs)

  if (it.lane === 'broll' || it.lane === 'music') {
    const minLen = it.lane === 'broll' ? BROLL_MIN_MS : MUSIC_MIN_MS
    const inMs = it.inMs ?? 0
    if (edge === 'start') {
      // Content stays anchored: moving the left edge right advances the media in-point.
      const lo = Math.max(0, it.startMs - inMs)
      const s = clamp(to, lo, it.endMs - minLen)
      if (s === it.startMs) return null
      const patch = { startMs: s, inMs: inMs + (s - it.startMs) }
      return it.lane === 'broll' ? patchBroll(ctx.edits, it.id, patch) : patchMusic(ctx.edits, patch)
    }
    const e = clamp(to, it.startMs + minLen, dur)
    if (e === it.endMs) return null
    return it.lane === 'broll' ? patchBroll(ctx.edits, it.id, { endMs: e }) : patchMusic(ctx.edits, { endMs: e })
  }

  if (it.lane === 'text') {
    const ms = clamp(to, HOOK_MIN_MS, HOOK_MAX_MS)
    const ho = ctx.edits.hookOverlay
    if (!ho || ms === ho.durationMs) return null
    return { ...ctx.edits, hookOverlay: { ...ho, durationMs: ms } }
  }

  if (it.lane === 'video') return trimVideoSegment(ctx, tb, it, edge, to)
  return null
}

function trimVideoSegment(
  ctx: OpCtx,
  tb: Timebase,
  it: TimelineItem,
  edge: 'start' | 'end',
  toMs: number,
): ClipEditsV2 | null {
  const a = it.srcInMs!
  const b = it.srcOutMs!
  const edits = ctx.edits
  const pv = ctx.previewEdits
  const clampTrim = ctx.clampTrim ?? ((t: { in: number; out: number }) => t)
  // Neighbouring kept source (in SOURCE order) bounds how far an edge may extend.
  const prevEnd = Math.max(pv.trim.in, ...tb.segs.filter(([, e]) => e <= a).map(([, e]) => e))
  const nextStart = Math.min(pv.trim.out, ...tb.segs.filter(([s]) => s >= b).map(([s]) => s))

  if (edge === 'start') {
    const delta = toMs - it.startMs
    let newA = a + delta
    newA = Math.min(newA, b - VIDEO_MIN_SEG_MS)
    if (a <= pv.trim.in + 1) {
      // Clip in-point: extend / shrink trim.in (may extend into handles before the AI bounds).
      const t = clampTrim({ in: newA, out: edits.trim.out })
      if (t.in === edits.trim.in) return null
      return { ...edits, trim: t, cutRanges: edits.cutRanges }
    }
    newA = Math.max(newA, prevEnd)
    if (newA === a) return null
    if (newA > a) return { ...edits, cutRanges: mergeCutRanges([...edits.cutRanges, [a, newA] as CutRange]) }
    return { ...edits, cutRanges: subtractRangeFromCuts(edits.cutRanges, [newA, a]) }
  }

  const delta = toMs - it.endMs
  let newB = b + delta
  newB = Math.max(newB, a + VIDEO_MIN_SEG_MS)
  if (b >= pv.trim.out - 1) {
    // Clip out-point: what you drag is what you get, so loop-friendly trim is turned off.
    const t = clampTrim({ in: edits.trim.in, out: newB })
    if (t.out === edits.trim.out && edits.loopFriendlyEnd === false) return null
    return { ...edits, trim: t, loopFriendlyEnd: false }
  }
  newB = Math.min(newB, nextStart)
  if (newB === b) return null
  if (newB < b) return { ...edits, cutRanges: mergeCutRanges([...edits.cutRanges, [newB, b] as CutRange]) }
  return { ...edits, cutRanges: subtractRangeFromCuts(edits.cutRanges, [b, newB]) }
}

/** Id for the right half of a split B-roll item (`<origin>~<atMs>`, unique within the list). */
export function splitBrollId(id: string, atMs: number, existing: string[] = []): string {
  const base = `${id.split('~')[0]}~${Math.round(atMs)}`
  let candidate = base
  let n = 2
  while (existing.includes(candidate)) candidate = `${base}-${n++}`
  return candidate
}

/**
 * Split at the playhead. With a selection: split the selected items that contain it.
 * Without: split the main video (layout segment boundary) — CapCut's default.
 */
export function splitAt(ctx: OpCtx, refs: ItemRef[], outMs: number): ClipEditsV2 | null {
  const locked = lockedLanes(ctx.edits)
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  const tb = timebaseFor(ctx.previewEdits)
  const t = Math.round(outMs)
  const targets: ItemRef[] = refs.length ? refs : [{ lane: 'video', id: '' }]
  let next = ctx.edits
  let changed = false
  for (const r of targets) {
    if (locked.has(r.lane)) continue
    if (r.lane === 'video') {
      const src = outputToSource(tb, t)
      if (t <= 0 || t >= tb.durationMs) continue
      const n = splitLayoutSegmentAt(next, src)
      if (n !== next) {
        next = n
        changed = true
      }
      continue
    }
    const it = findItem(lanes, r)
    if (!it?.caps.split) continue
    if (r.lane === 'broll') {
      if (t - it.startMs < BROLL_MIN_MS || it.endMs - t < BROLL_MIN_MS) continue
      const src = (next.broll ?? []).find((b) => b.id === it.id)
      if (!src) continue
      const left = { ...src, endMs: t } as BrollItem
      const right = {
        ...src,
        id: splitBrollId(src.id, t, (next.broll ?? []).map((b) => b.id)),
        startMs: t,
        inMs: (src.inMs ?? 0) + (t - src.startMs),
      } as BrollItem
      const list = next.broll ?? []
      const idx = list.findIndex((b) => b.id === src.id)
      next = { ...next, broll: [...list.slice(0, idx), left, right, ...list.slice(idx + 1)] }
      changed = true
    }
  }
  return changed ? next : null
}

/** Delete items. Video segments become cut ranges (never deletes the last segment). */
export function deleteItems(ctx: OpCtx, refs: ItemRef[]): ClipEditsV2 | null {
  const locked = lockedLanes(ctx.edits)
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  let next = ctx.edits
  let changed = false
  const videoCuts: CutRange[] = []
  for (const r of refs) {
    if (locked.has(r.lane)) continue
    const it = findItem(lanes, r)
    if (!it?.caps.del) continue
    changed = true
    if (r.lane === 'broll') next = { ...next, broll: (next.broll ?? []).filter((b) => b.id !== r.id) }
    else if (r.lane === 'music' && next.audio) next = { ...next, audio: { ...next.audio, music: null } }
    else if (r.lane === 'sfx' && next.audio)
      next = { ...next, audio: { ...next.audio, sfx: next.audio.sfx.filter((s) => s.generationId !== r.id) } }
    else if (r.lane === 'text' && next.hookOverlay) next = { ...next, hookOverlay: { ...next.hookOverlay, enabled: false } }
    else if (r.lane === 'video') videoCuts.push([it.srcInMs!, it.srcOutMs!])
  }
  if (videoCuts.length) {
    if (videoCuts.length >= lanes.video.length) {
      videoCuts.pop() // keep at least one segment
    }
    if (videoCuts.length) next = { ...next, cutRanges: mergeCutRanges([...next.cutRanges, ...videoCuts]) }
  }
  return changed && next !== ctx.edits ? next : null
}

// ---------------------------------------------------------------------------
// Ripple: keep B-roll / SFX / windowed music on the same SOURCE content when the
// EDL (cuts, trim, order, silence trim) changes — Descript-style. Fixes bars that
// "sit off" after transcript cuts.
// ---------------------------------------------------------------------------

function sameSegs(a: Timebase, b: Timebase): boolean {
  if (a.segs.length !== b.segs.length) return false
  return a.segs.every(([s, e], i) => s === b.segs[i]![0] && e === b.segs[i]![1])
}

function anchoredJson(e: ClipEditsV2): string {
  return JSON.stringify([e.broll ?? [], e.audio?.sfx ?? [], e.audio?.music ?? null])
}

export function rippleAnchoredItems(
  prev: ClipEditsV2,
  next: ClipEditsV2,
  prevPreview: ClipEditsV2,
  nextPreview: ClipEditsV2,
): ClipEditsV2 {
  // Only ripple when the change was to the EDL, not to the anchored items themselves.
  if (anchoredJson(prev) !== anchoredJson(next)) return next
  if (!(next.broll?.length || next.audio?.sfx?.length || next.audio?.music)) return next
  const a = timebaseFor(prevPreview)
  const b = timebaseFor(nextPreview)
  if (sameSegs(a, b)) return next
  const mapStart = (out: number) => sourceToOutputSnapped(b, outputToSource(a, out))
  const mapEnd = (out: number) => sourceToOutputSnapped(b, outputToSourceEnd(a, out))
  const dur = b.durationMs
  let out = next
  if (next.broll?.length) {
    out = {
      ...out,
      broll: next.broll.map((it) => {
        let s = mapStart(it.startMs)
        let e = mapEnd(it.endMs)
        if (e - s < BROLL_MIN_MS) e = s + BROLL_MIN_MS
        if (e > dur) {
          e = dur
          s = Math.max(0, Math.min(s, e - BROLL_MIN_MS))
        }
        return s === it.startMs && e === it.endMs ? it : ({ ...it, startMs: s, endMs: e } as BrollItem)
      }),
    }
  }
  const audio = next.audio
  if (audio) {
    let au = audio
    if (au.sfx.length) {
      au = {
        ...au,
        sfx: au.sfx.map((s) => {
          const at = Math.min(Math.max(0, dur - 1), mapStart(s.atMs))
          return at === s.atMs ? s : { ...s, atMs: at }
        }),
      }
    }
    const m = au.music
    if (m && (m.startMs != null || m.endMs != null)) {
      const wasFull = m.endMs == null || m.endMs >= a.durationMs
      const s = m.startMs != null ? mapStart(m.startMs) : undefined
      const e = wasFull ? undefined : mapEnd(m.endMs!)
      au = { ...au, music: { ...m, startMs: s, endMs: e } }
    }
    if (au !== audio) out = { ...out, audio: au }
  }
  return out
}

// ---------------------------------------------------------------------------
// Export parity helpers (mirrored in worker; asserted by the shared fixture)
// ---------------------------------------------------------------------------

export type RenderTimingSpec = {
  durationMs: number
  broll: { startMs: number; endMs: number; inMs: number }[]
  music: MusicWindow | null
  sfx: { atMs: number }[]
  voiceMuted: boolean
  hookOverlayMs: number | null
}

/** What the export must render, in output ms, for given (already lane-applied) effective edits. */
export function renderTimingSpec(effective: ClipEditsV2): RenderTimingSpec {
  const rendered = applyTimelineLaneState(effective)
  const dur = timebaseFor(rendered).durationMs
  return {
    durationMs: dur,
    broll: (rendered.broll ?? []).map((b) => ({ startMs: b.startMs, endMs: b.endMs, inMs: b.inMs ?? 0 })),
    music: musicWindow(rendered.audio?.music, dur),
    sfx: (rendered.audio?.sfx ?? []).map((s) => ({ atMs: s.atMs })),
    voiceMuted: voiceMuted(effective),
    hookOverlayMs: rendered.hookOverlay?.enabled ? clamp(rendered.hookOverlay.durationMs ?? 2500, HOOK_MIN_MS, HOOK_MAX_MS) : null,
  }
}

/** B-roll preview media for split items (same asset/generation as the original). */
export function brollMediaForItems<
  R extends { id: string; assetId?: string; generationId?: string; url: string | null },
>(items: BrollItem[], rows: R[]): R[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const out = [...rows]
  for (const it of items) {
    if (byId.has(it.id)) continue
    const match = rows.find((r) =>
      it.source === 'ai' ? r.generationId === it.generationId : r.assetId === it.assetId,
    ) ?? byId.get(it.id.split('~')[0]!)
    if (match) out.push({ ...match, id: it.id })
  }
  return out
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
