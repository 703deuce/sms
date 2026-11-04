/**
 * G1b: timeline editing ops on top of the E2 model (pure, no React). Each returns NEW edits (one
 * undo step) or null for a no-op.
 *
 *  - clipboard: copy / cut / paste / duplicate text, B-roll and SFX items with their keyframes,
 *    flip / z and color; paste attributes (style, keyframes, flip, color) onto same-kind items
 *  - main-track reorder: drag a Video segment before another (edits.sectionOrder, ripple)
 *  - in / out range: delete the range from the main track (ripple, a cut range)
 *  - cut points for ↑ / ↓ playhead jumps
 *  - track moves of items (drag between tracks)
 */
import { DEFAULT_SFX_VOLUME, type ClipAudioSfx, type ClipEditsAudio } from '@/lib/clips/audio'
import { BROLL_MIN_MS, type BrollItem } from '@/lib/clips/broll'
import { mergeCutRanges, normalizeSectionOrder, pruneVideoSplitsInCutRanges, type ClipEditsV2, type CutRange } from '@/lib/clips/edits'
import {
  buildTimelineItems,
  deleteItems,
  findItem,
  newGapId,
  markRippled,
  refLocked,
  refTrack,
  splitBrollId,
  timebaseFor,
  videoLaneSegments,
  type ItemRef,
  type OpCtx,
  type TimelineItem,
} from '@/lib/clips/editor/clip-timeline'
import { addGapAt, GAP_SOURCE_ID } from '@/lib/clips/editor/inserts'
import type { ColorSpec } from '@/lib/clips/editor/color'
import { setBrollFx, type LayerFx } from '@/lib/clips/editor/layer-fx'
import type { KeyframeTarget, KeyframeTrack, LayerProp } from '@/lib/clips/editor/motion-schema'
import { rippleGlobalKeyframes } from '@/lib/clips/editor/keyframes'
import { remapCutTransitions } from '@/lib/clips/editor/transitions'
import { remapSplitEdits } from '@/lib/clips/editor/split-edits'
import { TEXT_MIN_MS, type TextItem } from '@/lib/clips/editor/text-items'
import { addTrack, DEFAULT_TRACK_ID, LANE_TRACK_KIND, setItemsTrack, trackById, trackState, type TrackKind } from '@/lib/clips/editor/tracks'
import { audioClipKind } from '@/lib/clips/editor/audio-kind'

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

type Attach = { keyframes: KeyframeTrack[]; layer?: Omit<LayerProp, 'target'>; color?: ColorSpec; fx?: Omit<LayerFx, 'target'> }
export type ClipboardEntry =
  | ({ kind: 'broll'; item: BrollItem; track: string } & Attach)
  | ({ kind: 'text'; item: TextItem; track: string } & Attach)
  | { kind: 'sfx'; cue: ClipAudioSfx; track: string; startMs: number }
export type TimelineClipboard = { v: 1; originMs: number; entries: ClipboardEntry[]; compound?: { name: string } }

const startOf = (e: ClipboardEntry) => (e.kind === 'sfx' ? e.startMs : e.item.startMs)

function attachOf(edits: ClipEditsV2, target: KeyframeTarget, colorKey?: string): Attach {
  const keyframes = (edits.keyframes ?? []).filter((t) => t.target === target).map((t) => ({ ...t, points: t.points.map((p) => ({ ...p })) }))
  const row = edits.layerProps?.find((r) => r.target === target)
  const layer = row ? (({ target: _t, ...rest }) => rest)(row) : undefined
  const color = colorKey ? edits.color?.broll?.[colorKey] : undefined
  // G4c: B-roll layer effects (mask / key / blend / reverse) travel with copy / paste / duplicate.
  const fxRow = colorKey ? edits.layerFx?.find((r) => r.target === `broll:${colorKey}`) : undefined
  const fx = fxRow ? (({ target: _t, ...rest }) => structuredCloneSafe(rest))(fxRow) : undefined
  return {
    keyframes,
    ...(layer && Object.keys(layer).length ? { layer } : {}),
    ...(color ? { color } : {}),
    ...(fx && Object.keys(fx).length ? { fx } : {}),
  }
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/** Copy the selected text / B-roll / SFX items (Video / Voice / Music / hook are not copyable). */
export function copyItems(edits: ClipEditsV2, refs: readonly ItemRef[]): TimelineClipboard | null {
  const entries: ClipboardEntry[] = []
  for (const r of refs) {
    const track = refTrack(edits, r) ?? ''
    if (r.lane === 'broll') {
      const item = edits.broll?.find((b) => b.id === r.id)
      if (item) entries.push({ kind: 'broll', item: { ...item }, track, ...attachOf(edits, `broll:${item.id}`, item.id) })
    } else if (r.lane === 'text' && r.id !== 'hook') {
      const item = edits.textItems?.find((t) => t.id === r.id)
      if (item) entries.push({ kind: 'text', item: { ...item, style: { ...item.style } }, track, ...attachOf(edits, `text:${item.id}`) })
    } else if (r.lane === 'sfx') {
      const cue = edits.audio?.sfx.find((s) => s.generationId === r.id)
      if (cue) entries.push({ kind: 'sfx', cue: { ...cue }, track, startMs: cue.atMs })
    }
  }
  if (!entries.length) return null
  return { v: 1, originMs: Math.min(...entries.map(startOf)), entries }
}

export function copyableRefs(refs: readonly ItemRef[]): ItemRef[] {
  return refs.filter((r) => r.lane === 'broll' || r.lane === 'sfx' || (r.lane === 'text' && r.id !== 'hook'))
}

function freshId(base: string, taken: Set<string>, maxLen = 64): string {
  const root = base.split('~')[0]!.replace(/-c\d+$/, '').slice(0, maxLen - 6)
  let n = 2
  let id = `${root}-c${n}`
  while (taken.has(id)) id = `${root}-c${++n}`
  taken.add(id)
  return id
}

export type PasteResult = { edits: ClipEditsV2; refs: ItemRef[]; skipped: number }

/**
 * Paste at `atMs` (output ms): the clipboard's earliest item lands on the playhead, the rest keep
 * their offsets. Items go back on their own track when it still exists and is unlocked, else on the
 * kind's default track. AI / stock SFX can't be placed twice (one cue per generation) → skipped.
 */
export function pasteItems(ctx: OpCtx, clip: TimelineClipboard, atMs: number): PasteResult | null {
  const dur = timebaseFor(ctx.previewEdits).durationMs
  let next: ClipEditsV2 = ctx.edits
  const refs: ItemRef[] = []
  let skipped = 0
  const brollIds = new Set((next.broll ?? []).map((b) => b.id))
  const textIds = new Set((next.textItems ?? []).map((t) => t.id))
  const sfxIds = new Set((next.audio?.sfx ?? []).map((s) => s.generationId))
  const byTrack = new Map<string, { kind: TrackKind; track: string; ids: string[] }>()
  const homeTrack = (kind: TrackKind, want: string) => {
    const t = trackById(next, want)
    return t && t.kind === kind && !trackState(next, t.id).locked ? t.id : DEFAULT_TRACK_ID[kind]
  }
  const remember = (kind: TrackKind, track: string, id: string) => {
    const k = `${kind}:${track}`
    const cur = byTrack.get(k) ?? { kind, track, ids: [] }
    cur.ids.push(id)
    byTrack.set(k, cur)
  }
  const shift = Math.round(atMs) - clip.originMs
  for (const e of clip.entries) {
    if (e.kind === 'broll') {
      const len = e.item.endMs - e.item.startMs
      const startMs = Math.max(0, Math.min(e.item.startMs + shift, dur - Math.max(BROLL_MIN_MS, len)))
      const endMs = Math.min(dur, startMs + len)
      if (endMs - startMs < BROLL_MIN_MS) {
        skipped++
        continue
      }
      const id = freshId(e.item.id, brollIds, 120)
      next = { ...next, broll: [...(next.broll ?? []), { ...e.item, id, startMs, endMs, placement: 'manual' } as BrollItem] }
      next = withAttach(next, `broll:${id}`, e, id)
      remember('overlay', homeTrack('overlay', e.track), id)
      refs.push({ lane: 'broll', id })
    } else if (e.kind === 'text') {
      const len = e.item.endMs - e.item.startMs
      const startMs = Math.max(0, Math.min(e.item.startMs + shift, dur - Math.max(TEXT_MIN_MS, len)))
      const endMs = Math.min(dur, startMs + len)
      if (endMs - startMs < TEXT_MIN_MS) {
        skipped++
        continue
      }
      const id = freshId(e.item.id, textIds)
      const list = [...(next.textItems ?? []), { ...e.item, id, startMs, endMs }].sort((p, q) => p.startMs - q.startMs)
      next = withAttach({ ...next, textItems: list }, `text:${id}`, e)
      remember('text', homeTrack('text', e.track), id)
      refs.push({ lane: 'text', id })
    } else {
      const up = e.cue.uploadId
      if (!up || !next.audio) {
        skipped++
        continue
      }
      let n = 2
      while (sfxIds.has(`${up}~${n}`)) n++
      if (String(n).length > 7) {
        skipped++
        continue
      }
      const id = `${up}~${n}`
      sfxIds.add(id)
      const atMs2 = Math.max(0, Math.min(dur - 1, e.startMs + shift))
      next = { ...next, audio: { ...next.audio, sfx: [...next.audio.sfx, { ...e.cue, generationId: id, atMs: atMs2 }] } }
      remember('audio', homeTrack('audio', e.track), id)
      refs.push({ lane: 'sfx', id })
    }
  }
  if (!refs.length) return null
  for (const { kind, track, ids } of byTrack.values()) {
    if (track !== DEFAULT_TRACK_ID[kind]) next = setItemsTrack(next, kind, ids, track) ?? next
  }
  return { edits: next, refs, skipped }
}

function withAttach(edits: ClipEditsV2, target: KeyframeTarget, a: Attach, colorKey?: string): ClipEditsV2 {
  let next = edits
  if (a.keyframes.length) {
    const rest = (next.keyframes ?? []).filter((t) => t.target !== target)
    next = { ...next, keyframes: [...rest, ...a.keyframes.map((t) => ({ ...t, target, points: t.points.map((p) => ({ ...p })) }))] }
  } else if (next.keyframes?.some((t) => t.target === target)) {
    const rest = next.keyframes.filter((t) => t.target !== target)
    next = { ...next, keyframes: rest.length ? rest : undefined }
  }
  const rows = (next.layerProps ?? []).filter((r) => r.target !== target)
  if (a.layer && Object.keys(a.layer).length) rows.push({ ...a.layer, target } as LayerProp)
  if (rows.length !== (next.layerProps ?? []).length || a.layer) next = { ...next, layerProps: rows.length ? rows : undefined }
  if (colorKey) {
    const broll = { ...(next.color?.broll ?? {}) }
    if (a.color) broll[colorKey] = a.color
    else delete broll[colorKey]
    const had = next.color?.broll?.[colorKey]
    if (a.color || had) next = { ...next, color: { ...(next.color ?? {}), broll: Object.keys(broll).length ? broll : undefined } }
    const fxHad = next.layerFx?.some((r) => r.target === `broll:${colorKey}`)
    if (a.fx || fxHad) next = { ...next, layerFx: setBrollFx(next.layerFx, colorKey, a.fx ? structuredCloneSafe(a.fx) : null) }
  }
  return next
}

/** Cut = copy + delete (one undo step). */
export function cutItems(ctx: OpCtx, refs: readonly ItemRef[]): { edits: ClipEditsV2; clip: TimelineClipboard } | null {
  const ok = copyableRefs(refs).filter((r) => !refLocked(ctx.edits, r))
  const clip = copyItems(ctx.edits, ok)
  if (!clip) return null
  const next = deleteItems(ctx, ok)
  return next ? { edits: next, clip } : null
}

/** Duplicate: a copy of the selection right after it (CapCut Ctrl+D), same tracks. */
export function duplicateItems(ctx: OpCtx, refs: readonly ItemRef[]): PasteResult | null {
  const clip = copyItems(ctx.edits, copyableRefs(refs))
  if (!clip) return null
  const end = Math.max(
    ...clip.entries.map((e) => (e.kind === 'sfx' ? e.startMs + 1000 : e.item.endMs)),
  )
  return pasteItems(ctx, clip, clip.originMs + (end - clip.originMs))
}

/**
 * Paste attributes (Descript ⇧⌘V): the first clipboard entry's look onto the selected items of the
 * same kind — text: style + preset + position + keyframes + z; B-roll: keyframes + flip + color
 * (+ G4c layer effects: mask / key / blend / reverse).
 * Timing and content stay.
 */
export function pasteAttributes(ctx: OpCtx, clip: TimelineClipboard, refs: readonly ItemRef[]): ClipEditsV2 | null {
  let next = ctx.edits
  let changed = false
  for (const r of refs) {
    if (refLocked(ctx.edits, r)) continue
    const src = clip.entries.find((e) => (e.kind === 'broll' && r.lane === 'broll') || (e.kind === 'text' && r.lane === 'text'))
    if (!src || src.kind === 'sfx') continue
    if (src.kind === 'text' && r.id !== 'hook') {
      const cur = next.textItems?.find((t) => t.id === r.id)
      if (!cur || cur.id === src.item.id) continue
      const patch: TextItem = { ...cur, style: { ...src.item.style }, x: src.item.x, y: src.item.y }
      if (src.item.presetId) patch.presetId = src.item.presetId
      else delete patch.presetId
      next = { ...next, textItems: (next.textItems ?? []).map((t) => (t.id === r.id ? patch : t)) }
      next = withAttach(next, `text:${r.id}`, src)
      changed = true
    } else if (src.kind === 'broll') {
      if (!next.broll?.some((b) => b.id === r.id) || r.id === src.item.id) continue
      next = withAttach(next, `broll:${r.id}`, src, r.id)
      changed = true
    }
  }
  return changed ? next : null
}

// ---------------------------------------------------------------------------
// Drag between tracks
// ---------------------------------------------------------------------------

/** Move items to another track of their kind (only refs of that track's kind; locked ones stay). */
export function moveItemsToTrack(edits: ClipEditsV2, refs: readonly ItemRef[], trackId: string): ClipEditsV2 | null {
  const dest = trackById(edits, trackId)
  if (!dest) return null
  const lane = dest.kind === 'overlay' ? 'broll' : dest.kind === 'text' ? 'text' : 'sfx'
  if (trackState(edits, trackId).locked) return null
  const ids = refs.filter((r) => r.lane === lane && !(r.lane === 'text' && r.id === 'hook') && !refLocked(edits, r)).map((r) => r.id)
  if (!ids.length) return null
  return setItemsTrack(edits, dest.kind, ids, trackId)
}

export function trackKindOfLane(lane: string): TrackKind | undefined {
  return LANE_TRACK_KIND[lane as keyof typeof LANE_TRACK_KIND]
}

// ---------------------------------------------------------------------------
// Main-track reorder (CapCut: drag a clip on the main track; the track stays gapless)
// ---------------------------------------------------------------------------

function splitBlocksAt(blocks: CutRange[], at: number): CutRange[] {
  const out: CutRange[] = []
  for (const [s, e] of blocks) {
    if (at > s && at < e) out.push([s, at], [at, e])
    else out.push([s, e])
  }
  return out
}

function hasKeep(edits: ClipEditsV2, [s, e]: CutRange): boolean {
  let t = s
  for (const [cs, ce] of mergeCutRanges(edits.cutRanges).filter(([a, b]) => b > s && a < e)) {
    if (cs - t >= 1) return true
    t = Math.max(t, ce)
  }
  return e - t >= 1
}

/**
 * Move Video segment `segId` (`seg:<srcIn>`) so it plays right before segment `beforeId`, or last
 * when `beforeId` is null. Works on `edits.sectionOrder` (blocks partitioning [trim.in, trim.out]
 * in output order): the same model as transcript rearrange, so the worker, captions, ripple of
 * B-roll / keyframes and word editing all follow. Returns null if nothing changes / not allowed.
 */
export function moveVideoSegment(ctx: OpCtx, segId: string, beforeId: string | null): ClipEditsV2 | null {
  const e = ctx.edits
  if (refLocked(e, { lane: 'video', id: segId })) return null
  // E5 source segments / E5b inserts are anchored to main-source spans, so they follow the move.
  const tb = timebaseFor(ctx.previewEdits)
  const vsegs = videoLaneSegments(tb, e.videoSplits)
  const i = vsegs.findIndex((v) => `seg:${v.a}` === segId)
  if (i < 0 || vsegs.length < 2) return null
  const j = beforeId == null ? vsegs.length : vsegs.findIndex((v) => `seg:${v.a}` === beforeId)
  if (j < 0 || j === i || j === i + 1) return null
  const { a, b } = vsegs[i]!
  const trimIn = e.trim.in
  const trimOut = e.trim.out
  let blocks: CutRange[] = normalizeSectionOrder(e.sectionOrder, trimIn, trimOut) ?? [[trimIn, trimOut]]
  blocks = splitBlocksAt(splitBlocksAt(blocks, a), b)
  const anchor = j < vsegs.length ? vsegs[j]!.a : null
  if (anchor != null) blocks = splitBlocksAt(blocks, anchor)
  const pi = blocks.findIndex(([s, x]) => s === a && x === b)
  if (pi < 0) return null
  const piece = blocks[pi]!
  let rest = blocks.filter((_, k) => k !== pi)
  if (anchor == null) {
    // Last in output: after the block holding the last segment's content.
    const last = vsegs[vsegs.length - 1]!
    const li = rest.findIndex(([s, x]) => last.a >= s && last.b <= x)
    rest = [...rest.slice(0, li + 1), piece, ...rest.slice(li + 1)]
  } else {
    const ai = rest.findIndex(([s]) => s === anchor)
    if (ai < 0) return null
    rest = [...rest.slice(0, ai), piece, ...rest.slice(ai)]
  }
  // Content-free blocks (only cut / silence) render nothing: fold each into its source neighbour so
  // no block is shorter than the 300 ms minimum.
  let changed = true
  while (changed) {
    changed = false
    for (let k = 0; k < rest.length; k++) {
      const [s, x] = rest[k]!
      if (x - s >= 300 && hasKeep(e, [s, x])) continue
      const left = rest.findIndex(([, y]) => y === s)
      const right = rest.findIndex(([y]) => y === x)
      if (left >= 0) rest[left] = [rest[left]![0], x]
      else if (right >= 0) rest[right] = [s, rest[right]![1]]
      else continue
      rest.splice(k, 1)
      changed = true
      break
    }
  }
  // Merge neighbours that are contiguous in source too.
  const merged: CutRange[] = []
  for (const r of rest) {
    const p = merged[merged.length - 1]
    if (p && p[1] === r[0]) p[1] = r[1]
    else merged.push([r[0], r[1]])
  }
  const norm = normalizeSectionOrder(merged, trimIn, trimOut)
  const natural = merged.length === 1
  if (!norm && !natural) return null
  const next: ClipEditsV2 = { ...e, sectionOrder: norm }
  if (!norm) delete next.sectionOrder
  if (JSON.stringify(next.sectionOrder ?? null) === JSON.stringify(e.sectionOrder ?? null)) return null
  return next
}

/**
 * B1: Magnet-off main-track drag. Reorder the linked video/voice source segments,
 * then leave a real black/silent gap where the moved piece used to sit.
 * Gap inserts are the same data model consumed by preview and export.
 * The ordinary magnet-on path continues to ripple without adding silence.
 */
export function moveVideoSegmentWithGap(ctx: OpCtx, segId: string, beforeId: string | null): ClipEditsV2 | null {
  const before = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits }).video
  const moved = before.find((v) => v.id === segId)
  if (!moved || refLocked(ctx.edits, { lane: 'video', id: segId })) return null
  const next = moveVideoSegment(ctx, segId, beforeId)
  if (!next) return null
  const duration = Math.round(moved.endMs - moved.startMs)
  if (duration < 200) return next
  // The original drop position is measured on the old edit timeline. The gap
  // occupies that slot after the reordered sections are placed, preserving
  // the empty space instead of treating Magnet-off exactly like Magnet-on.
  const nextPreview = { ...ctx.previewEdits, sectionOrder: next.sectionOrder }
  const inserts = addGapAt(next.inserts, timebaseFor(nextPreview).segs, moved.startMs, newGapId(), duration)
  return inserts ? { ...next, inserts } : null
}

/**
 * B1 retest: a Magnet-off main clip can be shifted within its reorder slot.
 * Inserting a real gap at its source boundary moves the video/linked voice in export
 * time without changing section order. A left drag consumes an existing gap at
 * that boundary; without one the clip cannot overlap the preceding main video.
 */
export function shiftVideoSegmentWithinSlot(ctx: OpCtx, segId: string, deltaMs: number): ClipEditsV2 | null {
  const item = buildTimelineItems({ edits: ctx.edits, previewEdits: ctx.previewEdits }).video.find(v => v.id === segId)
  if (!item || item.srcInMs == null || refLocked(ctx.edits, { lane: 'video', id: segId })) return null
  const delta = Math.round(deltaMs)
  if (Math.abs(delta) < 1) return null
  const inserts = ctx.edits.inserts ?? []
  // Gap inserts are anchored to a source coordinate and displayed before the clip at that point.
  const atSrcMs = item.srcInMs
  const existing = inserts.filter(ins => !ins.append && ins.atSrcMs === atSrcMs && ins.sourceId === GAP_SOURCE_ID)
  if (delta < 0) {
    const gap = existing[existing.length - 1]
    if (!gap) return null
    const newDuration = gap.durMs + delta
    return { ...ctx.edits, inserts: inserts.flatMap(ins =>
      ins.id !== gap.id ? [ins] : newDuration >= 100 ? [{ ...ins, durMs: newDuration }] : []) }
  }
  const gap = existing[existing.length - 1]
  if (gap) return { ...ctx.edits, inserts: inserts.map(ins =>
    ins.id === gap.id ? { ...ins, durMs: Math.min(600_000, ins.durMs + delta) } : ins) }
  const next = addGapAt(inserts, timebaseFor(ctx.previewEdits).segs, item.startMs, newGapId(), delta)
  return next ? { ...ctx.edits, inserts: next } : null
}

/** Main-track reorder drop slot from the POINTER position (output ms). null = after last. */
export function reorderInsertBefore(
  video: { id: string; startMs: number; endMs: number }[],
  dragId: string,
  pointerMs: number,
): string | null {
  const others = video.filter((v) => v.id !== dragId)
  return others.find((v) => pointerMs < (v.startMs + v.endMs) / 2)?.id ?? null
}

export function isNoopReorder(video: { id: string }[], dragId: string, before: string | null): boolean {
  const i = video.findIndex((v) => v.id === dragId)
  return before === (video[i + 1]?.id ?? null)
}

// ---------------------------------------------------------------------------
// In / out range + cut points
// ---------------------------------------------------------------------------

export type InOut = { inMs: number | null; outMs: number | null }

export function rangeOf(io: InOut, durationMs: number): [number, number] | null {
  const a = io.inMs ?? 0
  const b = io.outMs ?? durationMs
  if (io.inMs == null && io.outMs == null) return null
  return b - a >= 1 ? [Math.max(0, a), Math.min(durationMs, b)] : null
}

/**
 * G1b3: extract the in/out range from EVERY unlocked track (ripple): the main track loses the range
 * (cut ranges, multicam / source segments follow — they are source-anchored), and on each unlocked
 * overlay / text / audio track items inside are deleted, items spanning it are split (B-roll: the
 * right part's in-point skips the removed media) or shortened (text, music), and everything after
 * moves left by the range length. Locked tracks keep their output times. Global (video / voice)
 * keyframes ripple the same way. The result is marked so the commit ripple doesn't map it twice.
 */
export function deleteRange(ctx: OpCtx, range: [number, number]): ClipEditsV2 | null {
  const main = deleteRangeMain(ctx, range)
  if (!main) return null
  const [r0, r1] = [Math.round(range[0]), Math.round(range[1])]
  const L = r1 - r0
  const f = (t: number) => (t <= r0 ? t : t < r1 ? r0 : t - L)
  const e0 = ctx.edits
  const locked = (lane: TimelineItem['lane'], id: string) => refLocked(e0, { lane, id })
  let out: ClipEditsV2 = main
  // B-roll
  if (e0.broll?.length) {
    const ids = e0.broll.map((b) => b.id)
    const list: BrollItem[] = []
    const newRight: { id: string; track: string }[] = []
    for (const b of e0.broll) {
      if (locked('broll', b.id) || b.endMs <= r0) list.push(b)
      else if (b.startMs >= r1) list.push({ ...b, startMs: b.startMs - L, endMs: b.endMs - L })
      else if (b.startMs >= r0 && b.endMs <= r1) continue
      else if (b.startMs < r0 && b.endMs > r1) {
        if (r0 - b.startMs >= BROLL_MIN_MS && b.endMs - r1 >= BROLL_MIN_MS) {
          const id = splitBrollId(b.id, r0, ids)
          ids.push(id)
          list.push({ ...b, endMs: r0 }, { ...b, id, startMs: r0, endMs: b.endMs - L, inMs: (b.inMs ?? 0) + (r1 - b.startMs) })
          newRight.push({ id, track: refTrack(e0, { lane: 'broll', id: b.id }) ?? DEFAULT_TRACK_ID.overlay })
        } else list.push({ ...b, endMs: Math.max(b.startMs + BROLL_MIN_MS, b.endMs - L) })
      } else if (b.startMs < r0) list.push({ ...b, endMs: Math.max(b.startMs + BROLL_MIN_MS, r0) })
      else {
        // starts inside, ends after: content from r1 on stays, lands at r0
        list.push({ ...b, startMs: r0, endMs: Math.max(r0 + BROLL_MIN_MS, b.endMs - L), inMs: (b.inMs ?? 0) + (r1 - b.startMs) })
      }
    }
    out = { ...out, broll: list }
    for (const n of newRight) if (n.track !== DEFAULT_TRACK_ID.overlay) out = setItemsTrack(out, 'overlay', [n.id], n.track) ?? out
  }
  // Text items: inside → deleted; spanning → shortened; partial → trimmed; after → shifted.
  if (e0.textItems?.length) {
    const list: TextItem[] = []
    for (const t of e0.textItems) {
      if (locked('text', t.id) || t.endMs <= r0) list.push(t)
      else if (t.startMs >= r0 && t.endMs <= r1) continue
      else {
        const s = f(t.startMs)
        const e = Math.max(s + TEXT_MIN_MS, f(t.endMs))
        list.push({ ...t, startMs: s, endMs: e })
      }
    }
    out = { ...out, textItems: list }
  }
  const au = e0.audio
  if (au) {
    let a2 = au
    if (au.sfx.length) {
      a2 = {
        ...a2,
        sfx: au.sfx
          .filter((c) => locked('sfx', c.generationId) || c.atMs < r0 || c.atMs >= r1)
          .map((c) => (!locked('sfx', c.generationId) && c.atMs >= r1 ? { ...c, atMs: c.atMs - L } : c)),
      }
    }
    const m = au.music
    if (m && !locked('music', m.generationId)) {
      const s = m.startMs != null ? f(m.startMs) : m.startMs
      const e = m.endMs != null ? Math.max((s ?? 0) + 1000, f(m.endMs)) : m.endMs
      if (s !== m.startMs || e !== m.endMs) a2 = { ...a2, music: { ...m, startMs: s, endMs: e } }
    }
    if (a2 !== au) out = { ...out, audio: a2 }
  }
  // Global (video / voice) keyframes, cut transitions and J / L keys.
  if (e0.keyframes?.length) {
    const kf = rippleGlobalKeyframes(e0.keyframes, f)
    if (kf !== e0.keyframes) out = { ...out, keyframes: kf }
  }
  const a = timebaseFor(ctx.previewEdits)
  const b = timebaseFor({ ...ctx.previewEdits, cutRanges: mergeCutRanges([...ctx.previewEdits.cutRanges, ...rangeCuts(ctx, range)]) })
  if (e0.transitions?.length) out = { ...out, transitions: remapCutTransitions(e0.transitions, a.segs, b.segs) }
  if (e0.splitEdits?.length) out = { ...out, splitEdits: remapSplitEdits(e0.splitEdits, a.segs, b.segs) }
  return markRippled(out)
}

function rangeCuts(ctx: OpCtx, range: [number, number]): CutRange[] {
  const tb = timebaseFor(ctx.previewEdits)
  const [r0, r1] = range
  const cuts: CutRange[] = []
  tb.segs.forEach(([a, b], k) => {
    const s = tb.starts[k]!
    const lo = Math.max(r0, s)
    const hi = Math.min(r1, s + (b - a))
    if (hi - lo >= 1) cuts.push([Math.round(a + (lo - s)), Math.round(a + (hi - s))])
  })
  return cuts
}

/** Delete the in/out range from the main track only: every source piece under it becomes a cut. */
export function deleteRangeMain(ctx: OpCtx, range: [number, number]): ClipEditsV2 | null {
  if (refLocked(ctx.edits, { lane: 'video', id: '' })) return null
  const tb = timebaseFor(ctx.previewEdits)
  const [r0, r1] = range
  const cuts: CutRange[] = []
  tb.segs.forEach(([a, b], k) => {
    const s = tb.starts[k]!
    const lo = Math.max(r0, s)
    const hi = Math.min(r1, s + (b - a))
    if (hi - lo >= 1) cuts.push([Math.round(a + (lo - s)), Math.round(a + (hi - s))])
  })
  if (!cuts.length) return null
  // Never cut everything.
  const total = tb.segs.reduce((n, [a, b]) => n + (b - a), 0)
  const removed = cuts.reduce((n, [a, b]) => n + (b - a), 0)
  if (total - removed < 200) return null
  const merged = mergeCutRanges([...ctx.edits.cutRanges, ...cuts])
  const videoSplits = pruneVideoSplitsInCutRanges(ctx.edits.videoSplits, cuts)
  const next: ClipEditsV2 = { ...ctx.edits, cutRanges: merged }
  if (videoSplits?.length) next.videoSplits = videoSplits
  else delete next.videoSplits
  return next
}

/** Items fully or partly inside the range (I/O → select). */
export function itemsInRange(lanes: Record<string, TimelineItem[]>, range: [number, number]): ItemRef[] {
  const out: ItemRef[] = []
  for (const lane of Object.keys(lanes)) {
    if (lane === 'voice') continue
    for (const it of lanes[lane]!) if (it.endMs > range[0] && it.startMs < range[1]) out.push({ lane: it.lane, id: it.id })
  }
  return out
}

/** Every item edge on the timeline (sorted, unique) for ↑ / ↓ "previous / next edit point". */
export function cutPoints(lanes: Record<string, TimelineItem[]>, durationMs: number): number[] {
  const set = new Set<number>([0, Math.round(durationMs)])
  for (const lane of Object.keys(lanes)) for (const it of lanes[lane]!) {
    set.add(Math.round(it.startMs))
    set.add(Math.round(it.endMs))
  }
  return [...set].sort((x, y) => x - y)
}

export function adjacentCutPoint(points: readonly number[], fromMs: number, dir: -1 | 1): number | null {
  if (dir > 0) return points.find((p) => p > fromMs + 1) ?? null
  for (let k = points.length - 1; k >= 0; k--) if (points[k]! < fromMs - 1) return points[k]!
  return null
}

export { findItem, buildTimelineItems }

// ---------------------------------------------------------------------------
// In-app clipboard (this tab; survives switching clips in the same editor session)
// ---------------------------------------------------------------------------

let clipboard: TimelineClipboard | null = null
export const timelineClipboard = {
  get: (): TimelineClipboard | null => clipboard,
  set: (c: TimelineClipboard | null) => {
    clipboard = c
  },
}

// ---------------------------------------------------------------------------
// G1b3: detach audio (B-roll upload video → its sound on an audio track)
// ---------------------------------------------------------------------------

/** True when the B-roll item is an uploaded video (has a sound to detach). */
export function canDetachAudio(edits: ClipEditsV2, brollId: string): boolean {
  const b = (edits.broll ?? []).find((x) => x.id === brollId)
  return Boolean(b && b.source === 'upload' && !b.still) && !refLocked(edits, { lane: 'sfx', id: '' })
}

/**
 * The clip's sound as an SFX-lane item at the same time / in-point / length (the B-roll picture is
 * silent in the export, so nothing doubles). Envelope, move, track and delete work like any SFX.
 */
export function detachBrollAudio(edits: ClipEditsV2, brollId: string): { edits: ClipEditsV2; id: string } | null {
  const b = (edits.broll ?? []).find((x) => x.id === brollId)
  if (!b || b.source !== 'upload' || b.still || !canDetachAudio(edits, brollId)) return null
  const sfx = edits.audio?.sfx ?? []
  const used = new Set(sfx.map((c) => c.generationId))
  let id = b.uploadId
  for (let n = 1; used.has(id); n++) id = `${b.uploadId}~${n}`
  const cue: ClipAudioSfx = {
    generationId: id,
    uploadId: b.uploadId,
    atMs: b.startMs,
    volume: DEFAULT_SFX_VOLUME,
    ...(b.inMs ? { inMs: b.inMs } : {}),
    durMs: b.endMs - b.startMs,
    kind: 'audio', // G2fix: labelled "Audio", not "SFX"
  }
  const audio: ClipEditsAudio = edits.audio ?? { music: null, sfx: [] }
  return { edits: { ...edits, audio: { ...audio, sfx: [...sfx, cue] } }, id }
}

// ---------------------------------------------------------------------------
// G1c: split stereo into two mono tracks (Premiere "Breakout to mono", Descript "Separate into mono")
// ---------------------------------------------------------------------------

/** Uploaded sound on the SFX lane, or an uploaded video B-roll clip (its sound). */
export function canSplitStereo(edits: ClipEditsV2, lane: string, id: string): boolean {
  if (refLocked(edits, { lane: 'sfx', id: '' })) return false
  if (lane === 'sfx') {
    const c = (edits.audio?.sfx ?? []).find((x) => x.generationId === id)
    return Boolean(c?.uploadId && !c.channel)
  }
  if (lane === 'broll') return canDetachAudio(edits, id)
  return false
}

/**
 * Two new audio tracks ("<name> L" / "<name> R"), each with a mono copy of one channel (same time,
 * in-point, length, volume and envelope). An SFX source item is replaced; a B-roll clip keeps its
 * (silent) picture. Each track then takes its own FX, mute and envelope — e.g. host / guest mics.
 */
export function splitStereoToTracks(
  edits: ClipEditsV2,
  lane: string,
  id: string,
): { edits: ClipEditsV2; ids: [string, string]; trackIds: [string, string] } | null {
  if (!canSplitStereo(edits, lane, id)) return null
  const sfx = edits.audio?.sfx ?? []
  let base: ClipAudioSfx
  let name = 'Mic'
  if (lane === 'sfx') {
    base = sfx.find((x) => x.generationId === id)!
    name = trackLabelOf(edits, refTrack(edits, { lane: 'sfx', id })) || 'Mic'
  } else {
    const b = (edits.broll ?? []).find((x) => x.id === id)
    if (!b || b.source !== 'upload') return null
    base = { generationId: b.uploadId, uploadId: b.uploadId, atMs: b.startMs, volume: DEFAULT_SFX_VOLUME, ...(b.inMs ? { inMs: b.inMs } : {}), durMs: b.endMs - b.startMs }
    name = 'Clip audio'
  }
  const up = base.uploadId!
  const used = new Set(sfx.filter((c) => !(lane === 'sfx' && c.generationId === id)).map((c) => c.generationId))
  const nextId = () => {
    let n = 1
    while (used.has(`${up}~${n}`)) n++
    const v = `${up}~${n}`
    used.add(v)
    return v
  }
  const idL = nextId()
  const idR = nextId()
  const kept = lane === 'sfx' ? sfx.filter((c) => c.generationId !== id) : sfx
  // G2fix: the halves of a song stay music (on "Music 2 L / R"); anything else is "Audio".
  const kind = lane === 'sfx' && audioClipKind(edits, base) === 'music' ? 'music' : 'audio'
  const cueL: ClipAudioSfx = { ...base, generationId: idL, channel: 'L', kind }
  const cueR: ClipAudioSfx = { ...base, generationId: idR, channel: 'R', kind }
  const audio: ClipEditsAudio = { ...(edits.audio ?? { music: null, sfx: [] }), sfx: [...kept, cueL, cueR] }
  let next: ClipEditsV2 = { ...edits, audio }
  // The source envelope follows both halves.
  const env = lane === 'sfx' ? (edits.keyframes ?? []).filter((k) => k.target === `sfx:${id}`) : []
  if (env.length || lane === 'sfx') {
    const others = (next.keyframes ?? []).filter((k) => k.target !== `sfx:${id}`)
    const copy = (to: string) => env.map((k) => ({ ...k, target: `sfx:${to}` as KeyframeTarget, points: k.points.map((p) => ({ ...p })) }))
    const kf = [...others, ...copy(idL), ...copy(idR)]
    next = { ...next, keyframes: kf.length ? kf : undefined }
  }
  const tL = addTrack(next, 'audio', { name: `${name} L`.slice(0, 40) })
  if (!tL) return null
  const tR = addTrack(tL.edits, 'audio', { name: `${name} R`.slice(0, 40), above: tL.trackId })
  if (!tR) return null
  next = setItemsTrack(tR.edits, 'audio', [idL], tL.trackId) ?? tR.edits
  next = setItemsTrack(next, 'audio', [idR], tR.trackId) ?? next
  return { edits: next, ids: [idL, idR], trackIds: [tL.trackId, tR.trackId] }
}

function trackLabelOf(edits: ClipEditsV2, trackId: string | null | undefined): string {
  if (!trackId) return ''
  const t = trackById(edits, trackId)
  if (!t) return ''
  return t.name ?? ''
}
