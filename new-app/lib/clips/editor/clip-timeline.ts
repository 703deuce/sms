/**
 * E2 multi-track timeline model for the clip editor (pure, no React).
 *
 * Single time base: OUTPUT ms of `editorPreviewEdits(edits, words)` — the same
 * effective edits (silence trim + loop-friendly end + section order) the worker
 * renders. Every lane item maps 1:1 onto an existing `edits` field:
 *
 *   text  → edits.hookOverlay (0 .. durationMs) + E4 edits.textItems[] {startMs, endMs} (output ms)
 *   video → keep segments of the EDL (trim + cutRanges + sectionOrder), further divided at
 *           edits.videoSplits (E2fix: S / Split on the Video lane)
 *   broll → edits.broll[] {startMs, endMs, inMs?}           (output ms)
 *   voice → same segments as video (waveform; mute only)
 *   music → edits.audio.music {startMs?, endMs?, inMs?}      (output ms)
 *   sfx   → edits.audio.sfx[] {atMs}                         (output ms)
 *
 * Lane mute/hide/lock lives in edits.timelineLanes and is applied for preview AND
 * export by `applyTimelineLaneState` (mirrored in worker `timeline_lanes.py`).
 */
import { splitAnim } from '@/lib/clips/editor/layer-anim'
import { applyItemEnable, reconcileItemFlags } from '@/lib/clips/editor/item-flags'
import { rippleMarkers } from '@/lib/clips/editor/markers'
import { magnetOn, rippleOverlaysOn } from '@/lib/clips/editor/timeline-opts'
import { GAP_SOURCE_ID, INSERT_MAX_MS, INSERT_MIN_MS, MAX_INSERTS } from '@/lib/clips/editor/inserts'
import type { ClipAudioMusic, ClipAudioSfx } from '@/lib/clips/audio'
import { DEFAULT_MUSIC_FADE_OUT_MS } from '@/lib/clips/audio'
import { BROLL_MIN_MS, type BrollItem } from '@/lib/clips/broll'
import {
  mergeCutRanges,
  orderedKeepSegments,
  subtractRangeFromCuts,
  type ClipEditsV2,
  type CutRange,
} from '@/lib/clips/edits'
import { splitLayoutSegmentAt } from '@/lib/clips/layout-segments'
import { reconcileItemMotion, rippleGlobalKeyframes } from '@/lib/clips/editor/keyframes'
import { remapCutTransitions } from '@/lib/clips/editor/transitions'
import { remapSplitEdits, splitEditAt, splitOffsets } from '@/lib/clips/editor/split-edits'
import { TEXT_MIN_MS, textItemLabel, type TextItem } from '@/lib/clips/editor/text-items'
import { ADJUST_MIN_MS, adjustLabel } from '@/lib/clips/editor/adjust-layers'
import {
  LANE_ORDER,
  LANE_TOGGLES,
  normalizeTimelineLanes,
  type LaneId,
  type LaneState,
  type TimelineLanesState,
} from '@/lib/clips/editor/timeline-lane-state'
import { applyTrackRender } from '@/lib/clips/editor/track-render'
import { inactiveBrollTakeIds, mainTakeLabel, takeLabel } from '@/lib/clips/editor/takes'
import { AUDIO_KIND_LABEL, audioClipKind } from '@/lib/clips/editor/audio-kind'
import { CAPTION_LINE_MIN_MS, splitCaptionLine, type CaptionLine } from '@/lib/clips/editor/caption-lines'
import {
  applyAudioSolo,
  applyTrackState,
  DEFAULT_TRACK_ID,
  effectiveTracks,
  LANE_TRACK_KIND,
  onDefaultTrack,
  trackIdOf,
  trackLabel,
  trackState,
  type TrackKind,
} from '@/lib/clips/editor/tracks'

export { LANE_ORDER, LANE_TOGGLES, normalizeTimelineLanes }
export type { LaneId, LaneState, TimelineLanesState }

export const LANE_LABELS: Record<LaneId, string> = {
  captions: 'Captions',
  text: 'Text',
  adjust: 'Adjustment',
  video: 'Video',
  broll: 'B-roll',
  voice: 'Voice',
  music: 'Music',
  sfx: 'SFX',
}

export const MUSIC_MIN_MS = 500
export const SFX_DEFAULT_MS = 1000
/** G2: shortest audio clip after a trim (the normalizer keeps durMs >= 100). */
export const SFX_MIN_MS = 100
export const HOOK_MIN_MS = 1500
export const HOOK_MAX_MS = 5000
export const VIDEO_MIN_SEG_MS = 200
/** One frame at 30 fps — arrow-key nudge step. Shift = 10 frames. */
export const NUDGE_MS = 33
/** E2fix: one arrow-key step (items AND playhead): 1 frame, Shift = 10 frames. */
export function arrowStepMs(shift: boolean): number {
  return NUDGE_MS * (shift ? 10 : 1)
}

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
  /** G1b: track id for text / B-roll / SFX items (lib/clips/editor/tracks.ts). */
  track?: string
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
  // G1b: hidden overlay / text tracks and muted audio tracks (non-default tracks) first.
  // G1c: takes / track color / track motion (worker: track_render.apply_track_render).
  // G2: solo first — it only sets mute flags, which the paths below honour.
  // TC1: deactivated items first (worker: timeline_lanes.apply_item_enable).
  const base = applyTrackRender(applyTrackState(applyAudioSolo(applyItemEnable(edits))))
  const lanes = normalizeTimelineLanes(base.timelineLanes)
  if (!lanes) return base
  let next: ClipEditsV2 = base
  // The E2 lane toggles are the DEFAULT track's state: with extra tracks they leave those alone.
  const onDef = (kind: TrackKind, id: string) => onDefaultTrack(base, kind, id)
  // G4a: a hidden Adjustment row renders (preview + export) without its layers.
  if (lanes.adjust?.hidden && (base.adjustLayers?.length ?? 0) > 0) next = { ...next, adjustLayers: undefined }
  if (lanes.broll?.hidden && (base.broll?.length ?? 0) > 0) next = { ...next, broll: base.broll!.filter((b) => !onDef('overlay', b.id)) }
  if (lanes.text?.hidden && base.hookOverlay?.enabled) {
    next = { ...next, hookOverlay: { ...base.hookOverlay, enabled: false } }
  }
  if (lanes.text?.hidden && (base.textItems?.length ?? 0) > 0) {
    const kept = base.textItems!.filter((t) => !onDef('text', t.id))
    next = { ...next, textItems: kept.length ? kept : undefined }
  }
  const audio = next.audio
  if (audio) {
    let a = audio
    if (lanes.music?.muted && a.music) a = { ...a, music: null }
    if (lanes.sfx?.muted && a.sfx.length) a = { ...a, sfx: a.sfx.filter((x) => !onDef('audio', x.generationId)) }
    if (lanes.voice?.muted && a.studioSound) a = { ...a, studioSound: null }
    if (a !== audio) next = { ...next, audio: a }
  }
  if (lanes.voice?.muted && next.audioTrack) next = { ...next, audioTrack: undefined }
  return next
}

export function voiceMuted(edits: ClipEditsV2): boolean {
  return Boolean(normalizeTimelineLanes(applyAudioSolo(edits).timelineLanes)?.voice?.muted)
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
  let endMs = clamp(rawEnd, Math.min(dur, startMs + MUSIC_MIN_MS), dur)
  const inMs = Math.max(0, Math.round(music.inMs ?? 0))
  // AU-33: extend to clip end when the bed stops ≤ fadeOut before the tail (export fade parity).
  if (startMs <= 0 && inMs <= 0 && endMs < dur) {
    const fadeOutMs = Math.max(0, Math.round(music.fadeOutMs ?? DEFAULT_MUSIC_FADE_OUT_MS))
    if (dur - endMs <= fadeOutMs + 50) endMs = dur
  }
  return { startMs, endMs, inMs: inMs }
}

// ---------------------------------------------------------------------------
// Lane items
// ---------------------------------------------------------------------------

const NO_CAPS: ItemCaps = { move: false, trimStart: false, trimEnd: false, split: false, del: false }

/**
 * E3 × E2fix: cut indices k (cut between segs[k-1] and segs[k]) where the SOURCE jumps — the only
 * places a transition is offered / rendered. videoSplits never enter the time base (the worker never
 * sees them), and touching keep segments (no source gap) are not cuts either.
 */
export function realCutIndices(tb: Timebase): number[] {
  const out: number[] = []
  for (let k = 1; k < tb.segs.length; k++) if (tb.segs[k]![0] - tb.segs[k - 1]![1] >= 1) out.push(k)
  return out
}

/** One Video-lane segment: a keep segment, or part of one after a split. */
export type VideoLaneSeg = { a: number; b: number; startMs: number }

/**
 * E2fix: keep segments (output order) divided at `edits.videoSplits` (source ms). A split
 * closer than VIDEO_MIN_SEG_MS to a segment edge is ignored. Output timing is unchanged.
 */
export function videoLaneSegments(tb: Timebase, splits: readonly number[] | undefined): VideoLaneSeg[] {
  const pts = [...(splits ?? [])].sort((x, y) => x - y)
  const out: VideoLaneSeg[] = []
  tb.segs.forEach(([a, b], i) => {
    let s = a
    for (const p of pts) {
      if (p - s < VIDEO_MIN_SEG_MS || b - p < VIDEO_MIN_SEG_MS) continue
      out.push({ a: s, b: p, startMs: tb.starts[i]! + (s - a) })
      s = p
    }
    out.push({ a: s, b, startMs: tb.starts[i]! + (s - a) })
  })
  return out
}

export function buildTimelineItems(input: {
  edits: ClipEditsV2
  previewEdits: ClipEditsV2
  sfxDurationsMs?: Record<string, number>
}): Record<LaneId, TimelineItem[]> {
  const { edits, previewEdits } = input
  const tb = timebaseFor(previewEdits)
  const dur = tb.durationMs
  const lanes: Record<LaneId, TimelineItem[]> = { captions: [], text: [], adjust: [], video: [], broll: [], voice: [], music: [], sfx: [] }
  const tracks = effectiveTracks(edits)

  const ho = edits.hookOverlay
  if (ho?.enabled) {
    lanes.text.push({
      lane: 'text',
      id: 'hook',
      startMs: 0,
      endMs: Math.min(dur, clamp(ho.durationMs ?? 2500, HOOK_MIN_MS, HOOK_MAX_MS)),
      label: ho.text?.trim() || 'Hook title',
      caps: { ...NO_CAPS, trimEnd: true, del: true },
      track: DEFAULT_TRACK_ID.text,
    })
  }
  // G3a: manual caption lines (output ms) — move / trim / split / delete on the Captions row.
  for (const l of edits.captionLines ?? []) {
    lanes.captions.push({
      lane: 'captions',
      id: l.id,
      startMs: l.startMs,
      endMs: l.endMs,
      label: l.text,
      caps: { move: true, trimStart: true, trimEnd: true, split: true, del: true },
    })
  }
  // G4a: adjustment layers (output ms) — move / trim / split / delete on the Adjustment row.
  ;(edits.adjustLayers ?? []).forEach((l, i) => {
    lanes.adjust.push({
      lane: 'adjust',
      id: l.id,
      startMs: l.startMs,
      endMs: l.endMs,
      label: adjustLabel(l, i),
      caps: { move: true, trimStart: true, trimEnd: true, split: true, del: true },
    })
  })
  for (const t of edits.textItems ?? []) {
    lanes.text.push({
      lane: 'text',
      id: t.id,
      startMs: t.startMs,
      endMs: t.endMs,
      label: textItemLabel(t),
      caps: { move: true, trimStart: true, trimEnd: true, split: true, del: true },
      track: trackIdOf(edits, 'text', t.id, tracks),
    })
  }

  const vsegs = videoLaneSegments(tb, edits.videoSplits)
  const multi = vsegs.length > 1
  vsegs.forEach(({ a, b, startMs }, i) => {
    lanes.video.push({
      lane: 'video',
      id: `seg:${a}`,
      startMs,
      endMs: startMs + (b - a),
      srcInMs: a,
      srcOutMs: b,
      label: mainTakeLabel(edits, a, b) ? `Clip ${i + 1} · ${mainTakeLabel(edits, a, b)}` : `Clip ${i + 1}`,
      caps: { move: false, trimStart: true, trimEnd: true, split: true, del: multi },
    })
  })
  // G1b3: J / L cuts — Voice pieces follow video-lane splits; sound may lead/lag picture at each boundary.
  const offs = splitOffsets(tb.segs, edits.splitEdits, previewEdits.trim.in, previewEdits.trim.out)
  const real = new Set(realCutIndices(tb))
  vsegs.forEach((vs, vi) => {
    const ki = tb.segs.findIndex(([a, b]) => a <= vs.a && vs.b <= b)
    if (ki < 0) return
    const [ka, kb] = tb.segs[ki]!
    const picStart = tb.starts[ki]! + (vs.a - ka)
    const picEnd = tb.starts[ki]! + (vs.b - ka)
    const firstInKeep = vs.a <= ka + 1
    const lastInKeep = vs.b >= kb - 1
    const startMs = picStart + (firstInKeep ? offs[ki]! : splitEditAt(edits, vs.a))
    const endMs = picEnd + (lastInKeep ? offs[ki + 1]! : splitEditAt(edits, vsegs[vi + 1]!.a))
    lanes.voice.push({
      lane: 'voice',
      id: `voice:${vs.a}`,
      startMs,
      endMs,
      srcInMs: vs.a + (firstInKeep ? offs[ki]! : splitEditAt(edits, vs.a)),
      srcOutMs: vs.b + (lastInKeep ? offs[ki + 1]! : splitEditAt(edits, vsegs[vi + 1]!.a)),
      label: (firstInKeep ? offs[ki]! : splitEditAt(edits, vs.a)) || (lastInKeep ? offs[ki + 1]! : splitEditAt(edits, vsegs[vi + 1]!.a)) ? 'Voice · split' : 'Voice',
      caps: { ...NO_CAPS, trimStart: !firstInKeep || real.has(ki), trimEnd: !lastInKeep || real.has(ki + 1) },
    })
  })

  // G1c: inactive takes are hidden (T cycles); the active one is labelled "Take i/n".
  const offTakes = inactiveBrollTakeIds(edits)
  for (const item of edits.broll ?? []) {
    if (offTakes.has(item.id)) continue
    const tk = takeLabel(edits, item.id)
    const kind = item.source === 'ai' ? 'AI B-roll' : item.source === 'upload' ? (item.still ? 'Image' : 'Upload B-roll') : 'Stock B-roll'
    lanes.broll.push({
      lane: 'broll',
      id: item.id,
      startMs: item.startMs,
      endMs: item.endMs,
      inMs: item.inMs ?? 0,
      label: tk ? `${kind} · ${tk}` : kind,
      caps: { move: true, trimStart: true, trimEnd: true, split: true, del: true },
      track: trackIdOf(edits, 'overlay', item.id, tracks),
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
    // G1b3: a detached clip sound plays [inMs, inMs + durMs] of its media.
    const media = input.sfxDurationsMs?.[s.generationId]
    const full = media != null ? media - (s.inMs ?? 0) : SFX_DEFAULT_MS
    // G2fix: a looping music clip plays its whole durMs.
    const len = Math.max(100, Math.round(s.durMs != null ? (s.loop ? s.durMs : Math.min(s.durMs, full)) : full))
    lanes.sfx.push({
      lane: 'sfx',
      id: s.generationId,
      startMs: s.atMs,
      endMs: s.atMs + len,
      // G2fix: songs read "Music", detached / split clip audio "Audio", the rest "SFX".
      label: AUDIO_KIND_LABEL[audioClipKind(edits, s, tracks)],
      // G2: audio clips trim (in-point / length) like the music bed.
      caps: { ...NO_CAPS, move: true, del: true, trimStart: true, trimEnd: true },
      track: trackIdOf(edits, 'audio', s.generationId, tracks),
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
  /** G2: beat markers (OUTPUT ms) of music / audio clips. */
  beatsMs?: number[]
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
  for (const b of input.beatsMs ?? []) set.add(Math.round(b))
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
  /** G2: decoded audio clip lengths (trim an audio clip up to its media end). */
  sfxDurationsMs?: Record<string, number>
  /** TC1fix: main magnet (user preference); undefined = the clip's timelineOpts (legacy). */
  magnet?: boolean
}

function lockedLanes(edits: ClipEditsV2): Set<LaneId> {
  const l = normalizeTimelineLanes(edits.timelineLanes)
  return new Set(LANE_ORDER.filter((id) => l?.[id]?.locked))
}

/** G1b: the track an item ref is on (text / B-roll / SFX), else null. */
export function refTrack(edits: ClipEditsV2, ref: ItemRef): string | null {
  const kind = LANE_TRACK_KIND[ref.lane]
  if (!kind) return null
  if (ref.lane === 'text' && ref.id === 'hook') return DEFAULT_TRACK_ID.text
  return trackIdOf(edits, kind, ref.id)
}

/** G1b: locked = its track is locked (default tracks: the E2 lane lock; fixed lanes: lane lock). */
export function refLocked(edits: ClipEditsV2, ref: ItemRef): boolean {
  const t = refTrack(edits, ref)
  if (t) return Boolean(trackState(edits, t).locked)
  return lockedLanes(edits).has(ref.lane)
}

/** G1b: one timeline row — a fixed lane (video / voice / music) or one track of a free kind. */
export type TimelineRow = { key: string; lane: LaneId; trackId?: string; label: string; isDefault: boolean }

/**
 * Rows top → bottom: the visual stack front-first (text and overlay tracks interleaved as the user
 * ordered them), the main Video track, Voice, Music, then the audio (SFX) tracks.
 */
export function timelineRows(edits: ClipEditsV2): TimelineRow[] {
  const ts = effectiveTracks(edits)
  const row = (t: { id: string; kind: TrackKind }): TimelineRow => {
    const lane = t.kind === 'overlay' ? 'broll' : t.kind === 'text' ? 'text' : 'sfx'
    const isDefault = t.id === DEFAULT_TRACK_ID[t.kind]
    return { key: isDefault ? lane : `${lane}:${t.id}`, lane, trackId: t.id, label: trackLabel(edits, t.id), isDefault }
  }
  const visual = ts.filter((t) => t.kind !== 'audio').reverse().map(row)
  const fixed = (lane: LaneId): TimelineRow => ({ key: lane, lane, label: LANE_LABELS[lane], isDefault: true })
  const caps = edits.captionLines?.length ? [fixed('captions')] : []
  // G4a: the Adjustment row sits under the text rows and above the overlay rows (it grades what is
  // below it — overlays + main video — and never the text).
  if (edits.adjustLayers?.length) {
    const firstOverlay = visual.findIndex((r) => r.lane === 'broll')
    visual.splice(firstOverlay < 0 ? visual.length : firstOverlay, 0, fixed('adjust'))
  }
  return [...caps, ...visual, fixed('video'), fixed('voice'), fixed('music'), ...ts.filter((t) => t.kind === 'audio').map(row)]
}

/** Row state (mute / hide / lock) for the header. */
export function rowState(edits: ClipEditsV2, r: TimelineRow): LaneState {
  return r.trackId ? trackState(edits, r.trackId) : laneState(edits, r.lane)
}

/** Items shown on a row. */
export function rowItems(lanes: Record<LaneId, TimelineItem[]>, r: TimelineRow): TimelineItem[] {
  const all = lanes[r.lane]
  return r.trackId ? all.filter((i) => (i.track ?? DEFAULT_TRACK_ID[LANE_TRACK_KIND[r.lane]!]) === r.trackId) : all
}

function patchBroll(edits: ClipEditsV2, id: string, patch: Partial<BrollItem>): ClipEditsV2 {
  return {
    ...edits,
    broll: (edits.broll ?? []).map((b) => (b.id === id ? ({ ...b, ...patch } as BrollItem) : b)),
  }
}

function patchText(edits: ClipEditsV2, id: string, patch: Partial<TextItem>): ClipEditsV2 {
  return { ...edits, textItems: (edits.textItems ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)) }
}

function patchAdjust(edits: ClipEditsV2, id: string, patch: { startMs?: number; endMs?: number }): ClipEditsV2 {
  return { ...edits, adjustLayers: (edits.adjustLayers ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)) }
}

function patchCaption(edits: ClipEditsV2, id: string, patch: Partial<CaptionLine>): ClipEditsV2 {
  return { ...edits, captionLines: (edits.captionLines ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)) }
}

/** G3a: free room around caption line `id` (neighbours not in `skip`) — lines never overlap. */
function captionRoom(edits: ClipEditsV2, id: string, dur: number, skip?: Set<string>): [number, number] {
  const me = (edits.captionLines ?? []).find((l) => l.id === id)
  let lo = 0
  let hi = dur
  if (!me) return [lo, hi]
  for (const l of edits.captionLines ?? []) {
    if (l.id === id || skip?.has(l.id)) continue
    if (l.endMs <= me.startMs) lo = Math.max(lo, l.endMs)
    else if (l.startMs >= me.endMs) hi = Math.min(hi, l.startMs)
  }
  return [lo, hi]
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
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  const dur = timebaseFor(ctx.previewEdits).durationMs
  const items = refs
    .filter((r) => !refLocked(ctx.edits, r))
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
    } else if (it.lane === 'captions') {
      const moving = new Set(items.filter((x) => x.lane === 'captions').map((x) => x.id))
      const [lo, hi] = captionRoom(ctx.edits, it.id, dur, moving)
      d = Math.max(d, lo - it.startMs)
      d = Math.min(d, Math.max(0, hi - it.endMs))
    } else {
      d = Math.max(d, -it.startMs)
      d = Math.min(d, Math.max(0, dur - len - it.startMs))
    }
  }
  if (!d) return null
  let next = ctx.edits
  for (const it of items) {
    if (it.lane === 'broll') next = patchBroll(next, it.id, { startMs: it.startMs + d, endMs: it.endMs + d })
    else if (it.lane === 'text') next = patchText(next, it.id, { startMs: it.startMs + d, endMs: it.endMs + d })
    else if (it.lane === 'music') next = patchMusic(next, { startMs: it.startMs + d, endMs: it.endMs + d })
    else if (it.lane === 'sfx') next = patchSfx(next, it.id, { atMs: it.startMs + d })
    else if (it.lane === 'captions') next = patchCaption(next, it.id, { startMs: it.startMs + d, endMs: it.endMs + d })
    else if (it.lane === 'adjust') next = patchAdjust(next, it.id, { startMs: it.startMs + d, endMs: it.endMs + d })
  }
  return next
}

/** Trim one edge of an item to `toMs` (output ms). */
export function trimItem(ctx: OpCtx, ref: ItemRef, edge: 'start' | 'end', toMs: number): ClipEditsV2 | null {
  if (refLocked(ctx.edits, ref)) return null
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits, sfxDurationsMs: ctx.sfxDurationsMs })
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

  if (it.lane === 'sfx') {
    // G2: audio clips trim like music — the left edge advances the media in-point, the right edge
    // sets the play length (never past the media end when its length is known).
    const cue = ctx.edits.audio?.sfx.find((s) => s.generationId === it.id)
    if (!cue) return null
    const inMs = cue.inMs ?? 0
    if (edge === 'start') {
      const s = clamp(to, Math.max(0, it.startMs - inMs), it.endMs - SFX_MIN_MS)
      if (s === it.startMs) return null
      return patchSfx(ctx.edits, it.id, { atMs: s, inMs: inMs + (s - it.startMs), durMs: it.endMs - s })
    }
    const media = ctx.sfxDurationsMs?.[it.id]
    // G2fix: a looping music clip extends past its media (up to the video end).
    const hi = media != null && !cue.loop ? it.startMs + Math.max(SFX_MIN_MS, media - inMs) : Math.max(it.endMs, dur)
    const e = clamp(to, it.startMs + SFX_MIN_MS, hi)
    if (e === it.endMs) return null
    return patchSfx(ctx.edits, it.id, { durMs: e - it.startMs })
  }

  if (it.lane === 'captions') {
    const [lo, hi] = captionRoom(ctx.edits, it.id, dur)
    if (edge === 'start') {
      const s = clamp(to, lo, it.endMs - CAPTION_LINE_MIN_MS)
      return s === it.startMs ? null : patchCaption(ctx.edits, it.id, { startMs: s })
    }
    const e = clamp(to, it.startMs + CAPTION_LINE_MIN_MS, hi)
    return e === it.endMs ? null : patchCaption(ctx.edits, it.id, { endMs: e })
  }

  if (it.lane === 'adjust') {
    // G4a: an adjustment layer has no media — both edges trim freely inside the video.
    if (edge === 'start') {
      const s = clamp(to, 0, it.endMs - ADJUST_MIN_MS)
      return s === it.startMs ? null : patchAdjust(ctx.edits, it.id, { startMs: s })
    }
    const e = clamp(to, it.startMs + ADJUST_MIN_MS, dur)
    return e === it.endMs ? null : patchAdjust(ctx.edits, it.id, { endMs: e })
  }

  if (it.lane === 'text' && it.id !== 'hook') {
    if (edge === 'start') {
      const s = clamp(to, 0, it.endMs - TEXT_MIN_MS)
      return s === it.startMs ? null : patchText(ctx.edits, it.id, { startMs: s })
    }
    const e = clamp(to, it.startMs + TEXT_MIN_MS, dur)
    return e === it.endMs ? null : patchText(ctx.edits, it.id, { endMs: e })
  }

  if (it.lane === 'text') {
    const ms = clamp(to, HOOK_MIN_MS, HOOK_MAX_MS)
    const ho = ctx.edits.hookOverlay
    if (!ho || ms === ho.durationMs) return null
    return { ...ctx.edits, hookOverlay: { ...ho, durationMs: ms } }
  }

  if (it.lane === 'video') return trimVideoSegment(ctx, tb, it, edge, to)
  if (it.lane === 'voice') {
    // G1b3: plain drag of a Voice edge = linked trim of the picture edge at the same cut.
    const k = tb.segs.findIndex(([a]) => `voice:${a}` === it.id)
    if (k < 0) return null
    const [a, b] = tb.segs[k]!
    const v = lanes.video.find((x) => (edge === 'start' ? x.srcInMs === a : x.srcOutMs === b))
    if (!v) return null
    const edgeNow = edge === 'start' ? v.startMs : v.endMs
    return trimVideoSegment(ctx, tb, v, edge, edgeNow + (to - (edge === 'start' ? it.startMs : it.endMs)))
  }
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
  // Neighbouring kept source (in SOURCE order) bounds how far an edge may extend. E2fix: a split
  // sibling is a neighbour too (an inner split edge can shrink its side, never eat the sibling).
  const vsegs = videoLaneSegments(tb, edits.videoSplits)
  const prevEnd = Math.max(pv.trim.in, ...vsegs.filter((v) => v.b <= a).map((v) => v.b))
  const nextStart = Math.min(pv.trim.out, ...vsegs.filter((v) => v.a >= b).map((v) => v.a))

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
 * Without: split the main video — CapCut's default.
 *
 * E2fix: a Video split adds a point to `edits.videoSplits`, so the Video lane really gets two
 * segments (before: only a layout-segment boundary, which normalizeLayoutSegments merges straight
 * back because both halves have the same mode — the split was invisible and lost on save). The
 * layout boundary is still added so each half can get its own layout this session.
 */
export function splitAt(ctx: OpCtx, refs: ItemRef[], outMs: number): ClipEditsV2 | null {
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  const tb = timebaseFor(ctx.previewEdits)
  const t = Math.round(outMs)
  const targets: ItemRef[] = refs.length ? refs : [{ lane: 'video', id: '' }]
  let next = ctx.edits
  let changed = false
  for (const r of targets) {
    if (refLocked(ctx.edits, r)) continue
    if (r.lane === 'video') {
      if (t <= 0 || t >= tb.durationMs) continue
      const vsegs = videoLaneSegments(tb, next.videoSplits)
      const seg = vsegs.find((v) => t > v.startMs && t < v.startMs + (v.b - v.a))
      if (!seg) continue
      // A selected Video segment only splits when the playhead is inside it.
      if (r.id && r.id !== `seg:${seg.a}`) continue
      const src = seg.a + (t - seg.startMs)
      if (src - seg.a < VIDEO_MIN_SEG_MS || seg.b - src < VIDEO_MIN_SEG_MS) continue
      next = splitLayoutSegmentAt(
        { ...next, videoSplits: [...(next.videoSplits ?? []), src].sort((x, y) => x - y) },
        src,
      )
      changed = true
      continue
    }
    const it = findItem(lanes, r)
    if (!it?.caps.split) continue
    if (r.lane === 'broll') {
      if (t - it.startMs < BROLL_MIN_MS || it.endMs - t < BROLL_MIN_MS) continue
      const src = (next.broll ?? []).find((b) => b.id === it.id)
      if (!src) continue
      const left = splitAnim({ ...src, endMs: t } as BrollItem, 'left')
      const right = splitAnim({
        ...src,
        id: splitBrollId(src.id, t, (next.broll ?? []).map((b) => b.id)),
        startMs: t,
        inMs: (src.inMs ?? 0) + (t - src.startMs),
      } as BrollItem, 'right')
      const list = next.broll ?? []
      const idx = list.findIndex((b) => b.id === src.id)
      next = { ...next, broll: [...list.slice(0, idx), left, right, ...list.slice(idx + 1)] }
      changed = true
    }
    if (r.lane === 'adjust') {
      if (t - it.startMs < ADJUST_MIN_MS || it.endMs - t < ADJUST_MIN_MS) continue
      const list = next.adjustLayers ?? []
      const idx = list.findIndex((x) => x.id === it.id)
      if (idx < 0) continue
      const src = list[idx]!
      const rid = splitBrollId(src.id, t, list.map((x) => x.id))
      next = {
        ...next,
        adjustLayers: [...list.slice(0, idx), { ...src, endMs: t }, { ...src, id: rid, startMs: t }, ...list.slice(idx + 1)],
        // The right half keeps the layer's color keyframes at the same output times.
        keyframes: [
          ...(next.keyframes ?? []),
          ...(next.keyframes ?? [])
            .filter((k) => k.target === `adjust:${src.id}`)
            .map((k) => ({ ...k, target: `adjust:${rid}` as const, points: k.points.map((p) => ({ ...p, tMs: p.tMs - (t - src.startMs) })) })),
        ],
      }
      changed = true
      continue
    }
    if (r.lane === 'captions') {
      const lines = next.captionLines ?? []
      const after = splitCaptionLine(lines, it.id, { ms: t })
      if (after !== lines) {
        next = { ...next, captionLines: after }
        changed = true
      }
      continue
    }
    if (r.lane === 'text') {
      if (t - it.startMs < TEXT_MIN_MS || it.endMs - t < TEXT_MIN_MS) continue
      const list = next.textItems ?? []
      const idx = list.findIndex((x) => x.id === it.id)
      if (idx < 0) continue
      const src = list[idx]!
      const right: TextItem = splitAnim({ ...src, id: splitBrollId(src.id, t, list.map((x) => x.id)), startMs: t }, 'right')
      next = { ...next, textItems: [...list.slice(0, idx), splitAnim({ ...src, endMs: t }, 'left'), right, ...list.slice(idx + 1)] }
      changed = true
    }
  }
  return changed ? next : null
}

/** E2fix: why a split did nothing (shown as a toast instead of silently ignoring S / Split). */
export function splitNoopMessage(edits: ClipEditsV2, refs: ItemRef[]): string {
  const rs: ItemRef[] = refs.length ? refs : [{ lane: 'video', id: '' }]
  if (rs.every((r) => refLocked(edits, r))) {
    const t = refTrack(edits, rs[0]!)
    const name = t && t !== DEFAULT_TRACK_ID[LANE_TRACK_KIND[rs[0]!.lane]!] ? trackLabel(edits, t) : LANE_LABELS[rs[0]!.lane]
    return `${name} ${t && name !== LANE_LABELS[rs[0]!.lane] ? 'track' : 'lane'} is locked — unlock it to split`
  }
  return refs.length
    ? 'Nothing to split — put the playhead inside the selected item'
    : 'Nothing to split here — move the playhead inside a clip'
}

/**
 * E3fix: Join — undo a Video split. Two Video-lane segments are joinable when the first ends
 * exactly where the second starts in SOURCE ms (same keep segment, no cut between them); joining
 * removes that point from `edits.videoSplits`. Keep-segment boundaries (real cuts) never join.
 */
export type VideoJoinOptions = { prev: number | null; next: number | null; between: number[] }

function videoSplitPointsAt(splits: readonly number[] | undefined, srcMs: number): number[] {
  return (splits ?? []).filter((p) => Math.abs(p - srcMs) <= 0.5)
}

export function videoJoinOptions(ctx: Pick<OpCtx, 'edits' | 'previewEdits'>, refs: ItemRef[]): VideoJoinOptions {
  const none: VideoJoinOptions = { prev: null, next: null, between: [] }
  if (lockedLanes(ctx.edits).has('video')) return none
  const tb = timebaseFor(ctx.previewEdits)
  const vsegs = videoLaneSegments(tb, ctx.edits.videoSplits)
  const joinable = (i: number) =>
    i > 0 &&
    i < vsegs.length &&
    vsegs[i - 1]!.b === vsegs[i]!.a &&
    videoSplitPointsAt(ctx.edits.videoSplits, vsegs[i]!.a).length > 0
  const idxs = refs
    .filter((r) => r.lane === 'video')
    .map((r) => vsegs.findIndex((v) => `seg:${v.a}` === r.id))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)
  if (!idxs.length) return none
  const between: number[] = []
  for (let j = 1; j < idxs.length; j++) {
    if (idxs[j] === idxs[j - 1]! + 1 && joinable(idxs[j]!)) between.push(vsegs[idxs[j]!]!.a)
  }
  if (idxs.length > 1) return { prev: null, next: null, between }
  const i = idxs[0]!
  return {
    prev: joinable(i) ? vsegs[i]!.a : null,
    next: joinable(i + 1) ? vsegs[i + 1]!.a : null,
    between,
  }
}

/** E3fix: remove the given split points (source ms) from `edits.videoSplits`. */
export function joinVideoSplits(ctx: Pick<OpCtx, 'edits'>, splitSrcMs: readonly number[]): ClipEditsV2 | null {
  if (!splitSrcMs.length || lockedLanes(ctx.edits).has('video')) return null
  const cur = ctx.edits.videoSplits ?? []
  const kept = cur.filter((p) => !splitSrcMs.some((q) => Math.abs(p - q) <= 0.5))
  if (kept.length === cur.length) return null
  return { ...ctx.edits, videoSplits: kept }
}

/** Delete items. Video segments become cut ranges (never deletes the last segment). */
export function deleteItems(ctx: OpCtx, refs: ItemRef[]): ClipEditsV2 | null {
  const lanes = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits })
  let next = ctx.edits
  let changed = false
  const videoCuts: CutRange[] = []
  for (const r of refs) {
    if (refLocked(ctx.edits, r)) continue
    const it = findItem(lanes, r)
    if (!it?.caps.del) continue
    changed = true
    if (r.lane === 'broll') next = { ...next, broll: (next.broll ?? []).filter((b) => b.id !== r.id) }
    else if (r.lane === 'music' && next.audio) next = { ...next, audio: { ...next.audio, music: null } }
    else if (r.lane === 'sfx' && next.audio)
      next = { ...next, audio: { ...next.audio, sfx: next.audio.sfx.filter((s) => s.generationId !== r.id) } }
    else if (r.lane === 'text' && r.id !== 'hook')
      next = { ...next, textItems: (next.textItems ?? []).filter((t) => t.id !== r.id) }
    else if (r.lane === 'captions') {
      const kept = (next.captionLines ?? []).filter((l) => l.id !== r.id)
      next = { ...next, captionLines: kept.length ? kept : undefined }
    } else if (r.lane === 'adjust') {
      const kept = (next.adjustLayers ?? []).filter((l) => l.id !== r.id)
      const kf = (next.keyframes ?? []).filter((k) => k.target !== `adjust:${r.id}`)
      next = { ...next, adjustLayers: kept.length ? kept : undefined, keyframes: kf.length ? kf : undefined }
    }
    else if (r.lane === 'text' && next.hookOverlay) next = { ...next, hookOverlay: { ...next.hookOverlay, enabled: false } }
    else if (r.lane === 'video') videoCuts.push([it.srcInMs!, it.srcOutMs!])
  }
  if (videoCuts.length) {
    if (videoCuts.length >= lanes.video.length) {
      videoCuts.pop() // keep at least one segment
    }
    if (videoCuts.length) next = { ...next, cutRanges: mergeCutRanges([...next.cutRanges, ...videoCuts]) }
    // TC1 (TL-08): magnet off — each deleted main segment leaves a black gap of its length, so the
    // rest of the timeline keeps its place (the gap sits before the next kept piece).
    if (videoCuts.length && !(ctx.magnet ?? magnetOn(ctx.edits.timelineOpts))) next = liftToGaps(next, lanes.video, videoCuts)
  }
  return changed && next !== ctx.edits ? next : null
}

/** TC1 (TL-34): "Replace with gap" — delete the selected main segments, leaving black gaps. */
export function replaceWithGaps(ctx: OpCtx, refs: ItemRef[]): ClipEditsV2 | null {
  const vids = refs.filter((r) => r.lane === 'video')
  if (!vids.length) return null
  const { timelineOpts, ...rest } = ctx.edits
  const next = deleteItems({ ...ctx, magnet: false, edits: { ...rest, timelineOpts: { ...(timelineOpts ?? {}), magnet: false } } as ClipEditsV2 }, vids)
  if (!next) return null
  const { timelineOpts: _drop, ...out } = next
  void _drop
  return (timelineOpts ? { ...out, timelineOpts } : out) as ClipEditsV2
}

let gapSeq = 0
/** TC1: unique insert id for a new gap clip. */
export function newGapId(): string {
  gapSeq = (gapSeq + 1) % 1_000_000
  return `gap_${Date.now().toString(36)}_${gapSeq}`
}

function liftToGaps(edits: ClipEditsV2, video: readonly TimelineItem[], cuts: readonly CutRange[]): ClipEditsV2 {
  const gone = new Set(cuts.map(([a]) => a))
  const inserts = [...(edits.inserts ?? [])]
  video.forEach((v, i) => {
    if (!gone.has(v.srcInMs!) || inserts.length >= MAX_INSERTS) return
    const after = video.slice(i + 1).find((x) => !gone.has(x.srcInMs!))
    const durMs = Math.min(INSERT_MAX_MS, Math.max(INSERT_MIN_MS, Math.round(v.endMs - v.startMs)))
    inserts.push({
      id: newGapId(),
      sourceId: GAP_SOURCE_ID,
      atSrcMs: after ? after.srcInMs! : 0,
      ...(after ? {} : { append: true as const }),
      inMs: 0,
      durMs,
      audio: 'mute',
    })
  })
  return inserts.length === (edits.inserts?.length ?? 0) ? edits : { ...edits, inserts }
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
  return JSON.stringify([e.broll ?? [], e.audio?.sfx ?? [], e.audio?.music ?? null, e.keyframes ?? null, e.textItems ?? null, e.captionLines ?? null, e.adjustLayers ?? null, e.blurRegions ?? null, e.markers ?? null])
}

/** E3: anything that must follow the EDL or its items (ripple / reconcile). */
export function hasAnchoredContent(e: ClipEditsV2): boolean {
  return Boolean(
    e.broll?.length ||
      e.audio?.sfx?.length ||
      e.audio?.music ||
      e.keyframes?.length ||
      e.transitions?.length ||
      e.splitEdits?.length ||
      e.textItems?.length ||
      e.captionLines?.length ||
      e.adjustLayers?.length ||
      e.blurRegions?.length ||
      e.markers?.length,
  )
}

const RIPPLED = new WeakSet<ClipEditsV2>()
/** G1b3: mark edits whose anchored items were already rippled by the op itself. */
export function markRippled(e: ClipEditsV2): ClipEditsV2 {
  RIPPLED.add(e)
  return e
}

export function rippleAnchoredItems(
  prev: ClipEditsV2,
  next: ClipEditsV2,
  prevPreview: ClipEditsV2,
  nextPreview: ClipEditsV2,
): ClipEditsV2 {
  // G1b3: an op that already placed every track (range extract) must not be mapped again.
  // TC1: split children inherit deactivated / group flags; deleted items leave them.
  if (RIPPLED.has(next)) return reconcileItemFlags(prev, reconcileItemMotion(prev, next))
  // E3: item edits keep their keyframes on the item's media (trim / split / delete).
  next = reconcileItemFlags(prev, reconcileItemMotion(prev, next))
  // Only ripple when the change was to the EDL, not to the anchored items themselves.
  if (anchoredJson(prev) !== anchoredJson(next)) return next
  if (!hasAnchoredContent(next)) return next
  const a = timebaseFor(prevPreview)
  const b = timebaseFor(nextPreview)
  if (sameSegs(a, b)) return next
  const mapStart = (out: number) => sourceToOutputSnapped(b, outputToSource(a, out))
  const mapEnd = (out: number) => sourceToOutputSnapped(b, outputToSourceEnd(a, out))
  const dur = b.durationMs
  // TC1 (TL-14/15): overlays unlinked from the main track keep their output time (clamped to the
  // new length); captions, blur regions, keyframes and markers still follow their content.
  const linked = rippleOverlaysOn(next.timelineOpts)
  const ovStart = linked ? mapStart : (x: number) => x
  const ovEnd = linked ? mapEnd : (x: number) => x
  // TC2c (TL-15): a main-track REORDER (same length, new section order) carries each linked overlay
  // with the main clip under its start, keeping its length — before, an overlay spanning a moved
  // cut had its start and end mapped into different blocks and was squashed / flipped.
  const reorder =
    linked && a.durationMs === b.durationMs && JSON.stringify(prev.sectionOrder ?? null) !== JSON.stringify(next.sectionOrder ?? null)
  const ovEndOf = (s0: number, e0: number, s1: number) => (reorder ? s1 + (e0 - s0) : ovEnd(e0))
  let out = next
  if (next.markers?.length) {
    const mk = rippleMarkers(next.markers, mapStart, dur)
    if (mk !== next.markers) out = { ...out, markers: mk.length ? mk : undefined }
  }
  if (next.keyframes?.length) {
    const kf = rippleGlobalKeyframes(next.keyframes, mapStart)
    if (kf !== next.keyframes) out = { ...out, keyframes: kf }
  }
  if (next.transitions?.length) {
    const tr = remapCutTransitions(next.transitions, a.segs, b.segs)
    if (tr !== next.transitions) out = { ...out, transitions: tr }
  }
  if (next.splitEdits?.length) {
    // G1b3: a J / L stays with its cut when a trim / roll moves the cut's right segment start.
    const sp = remapSplitEdits(next.splitEdits, a.segs, b.segs)
    if (sp !== next.splitEdits) out = { ...out, splitEdits: sp }
  }
  if (next.broll?.length) {
    out = {
      ...out,
      broll: next.broll.map((it) => {
        let s = ovStart(it.startMs)
        let e = ovEndOf(it.startMs, it.endMs, s)
        if (e - s < BROLL_MIN_MS) e = s + BROLL_MIN_MS
        if (e > dur) {
          e = dur
          s = Math.max(0, Math.min(s, e - BROLL_MIN_MS))
        }
        return s === it.startMs && e === it.endMs ? it : ({ ...it, startMs: s, endMs: e } as BrollItem)
      }),
    }
  }
  if (next.blurRegions?.length) {
    // G4c: blur regions follow the footage they cover (mask keys stay region-local).
    out = {
      ...out,
      blurRegions: next.blurRegions.map((r) => {
        let s = mapStart(r.startMs)
        let e = mapEnd(r.endMs)
        if (e - s < 100) e = s + 100
        if (e > dur) {
          e = dur
          s = Math.max(0, Math.min(s, e - 100))
        }
        return s === r.startMs && e === r.endMs ? r : { ...r, startMs: s, endMs: e }
      }),
    }
  }
  if (next.textItems?.length) {
    // E4: text items follow their source content like B-roll.
    out = {
      ...out,
      textItems: next.textItems.map((it) => {
        let s = ovStart(it.startMs)
        let e = ovEndOf(it.startMs, it.endMs, s)
        if (e - s < TEXT_MIN_MS) e = s + TEXT_MIN_MS
        if (e > dur) {
          e = dur
          s = Math.max(0, Math.min(s, e - TEXT_MIN_MS))
        }
        return s === it.startMs && e === it.endMs ? it : { ...it, startMs: s, endMs: e }
      }),
    }
  }
  if (next.adjustLayers?.length) {
    // G4a: adjustment layers follow the content under them like text items.
    out = {
      ...out,
      adjustLayers: next.adjustLayers.map((l) => {
        let s = ovStart(l.startMs)
        let e = ovEndOf(l.startMs, l.endMs, s)
        if (e - s < ADJUST_MIN_MS) e = s + ADJUST_MIN_MS
        if (e > dur) {
          e = dur
          s = Math.max(0, Math.min(s, e - ADJUST_MIN_MS))
        }
        return s === l.startMs && e === l.endMs ? l : { ...l, startMs: s, endMs: e }
      }),
    }
  }
  if (next.captionLines?.length) {
    // G3a: caption lines follow their speech like text items; a line whose speech was cut goes.
    const kept: CaptionLine[] = []
    for (const l of next.captionLines) {
      const s = mapStart(l.startMs)
      const e = Math.min(dur, mapEnd(l.endMs))
      if (e - s < CAPTION_LINE_MIN_MS) continue
      kept.push(s === l.startMs && e === l.endMs ? l : { ...l, startMs: s, endMs: e })
    }
    out = { ...out, captionLines: kept.length ? kept : undefined }
  }
  const audio = next.audio
  if (audio) {
    let au = audio
    if (au.sfx.length) {
      au = {
        ...au,
        sfx: au.sfx.map((s) => {
          const at = Math.min(Math.max(0, dur - 1), ovStart(s.atMs))
          return at === s.atMs ? s : { ...s, atMs: at }
        }),
      }
    }
    const m = au.music
    if (m && (m.startMs != null || m.endMs != null)) {
      const wasFull = m.endMs == null || m.endMs >= a.durationMs
      const s = m.startMs != null ? ovStart(m.startMs) : undefined
      const e = wasFull ? undefined : ovEnd(m.endMs!)
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
  R extends { id: string; assetId?: string; generationId?: string; uploadId?: string; url: string | null },
>(items: BrollItem[], rows: R[]): R[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const out = [...rows]
  for (const it of items) {
    if (byId.has(it.id)) continue
    const match = rows.find((r) =>
      it.source === 'ai'
        ? r.generationId === it.generationId
        : it.source === 'upload'
          ? r.uploadId === it.uploadId
          : r.assetId === it.assetId,
    ) ?? byId.get(it.id.split('~')[0]!)
    if (match) out.push({ ...match, id: it.id })
  }
  return out
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
