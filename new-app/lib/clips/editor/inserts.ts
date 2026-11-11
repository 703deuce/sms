/**
 * E5b insert / append: footage from another source that LENGTHENS the video (ripple), unlike E5
 * source segments, which replace the picture over a main-source span and never move the timeline.
 *
 * Model (`edits.inserts`): each insert is anchored to a MAIN SOURCE ms point (`atSrcMs`), so it moves
 * with the content around it when words are cut, or to the end of the clip (`append`). The edit timeline
 * that every existing lane uses (output ms of the effective edits) is unchanged. Inserts sit
 * between its frames, and the DISPLAY / export timeline is that timeline with each insert spliced in:
 *
 *   display(base) = base + Σ dur(insert at basePoint ≤ base)
 *
 * so everything after an insert point (video, captions, B-roll, text, music, SFX) shifts right by the
 * insert's length. That is the ripple. Overlays never cover an insert; it plays its own sound or silence.
 *
 * Export: the worker renders the base edit exactly as before, then splices the inserts into the
 * finished file (worker `media_inserts.py`, parity fixture `e5b_parity.json`).
 */
import type { ClipMediaSource, SourceFit } from '@/lib/clips/editor/sources'

export type InsertAudio = 'source' | 'mute'

export type ClipInsert = {
  id: string
  sourceId: string
  /** Main source ms: the insert plays right before this point. Ignored when `append`. */
  atSrcMs: number
  /** At the end of the clip, whatever the trim / cuts become. */
  append?: true
  /** Media in-point (video). */
  inMs: number
  durMs: number
  /** Sound during the insert: the clip's own track (default for video) or silence. */
  audio?: InsertAudio
  fit?: SourceFit
}

/**
 * G1b3: freeze frame — an insert with this reserved sourceId holds the composed frame at its point
 * (export: the finished frame at baseMs, cloned; preview: the paused main + overlays at baseMs).
 * Silent. No media source needed.
 */
export const FREEZE_SOURCE_ID = 'freeze'
export const FREEZE_DEFAULT_MS = 3000
/**
 * TC1 (TL-34 gap clips, TL-08 magnet off): a gap is an insert with this reserved sourceId — black
 * picture + silence for its length (export: lavfi `color` + `anullsrc` in the splice graph;
 * preview: a black box). Like every insert it lengthens the video and moves everything after it.
 */
export const GAP_SOURCE_ID = 'gap'
export const GAP_DEFAULT_MS = 1000
const RESERVED_SOURCE_IDS = new Set([FREEZE_SOURCE_ID, GAP_SOURCE_ID])

export const INSERT_MIN_MS = 200
export const INSERT_MAX_MS = 10 * 60 * 1000
export const MAX_INSERTS = 50
export const INSERT_IMAGE_DEFAULT_MS = 3000

function int(v: unknown): number | undefined {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? n : undefined
}

function safeId(v: unknown): string {
  const s = String(v ?? '').trim()
  return /^[A-Za-z0-9_:.~-]{1,120}$/.test(s) ? s : ''
}

/** Known video / image sources only, durations clamped. Array order is kept (ties play in order). */
export function normalizeInserts(raw: unknown, sources: readonly ClipMediaSource[] | undefined, youtubeLongForm = false): ClipInsert[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const byId = new Map((sources ?? []).map((s) => [s.id, s]))
  const out: ClipInsert[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = safeId(o.id)
    const at = int(o.atSrcMs)
    const dur = int(o.durMs)
    const reserved = safeId(o.sourceId)
    if (RESERVED_SOURCE_IDS.has(reserved)) {
      if (!id || seen.has(id) || at === undefined || dur === undefined || dur < INSERT_MIN_MS) continue
      seen.add(id)
      out.push({
        id,
        sourceId: reserved,
        atSrcMs: Math.max(0, at),
        ...(o.append === true ? { append: true as const } : {}),
        inMs: 0,
        durMs: Math.min(dur, INSERT_MAX_MS),
        audio: 'mute',
      })
      if (!youtubeLongForm && out.length >= MAX_INSERTS) break
      continue
    }
    const src = byId.get(safeId(o.sourceId))
    if (!id || seen.has(id) || !src || src.mediaType === 'audio' || at === undefined || dur === undefined) continue
    if (dur < INSERT_MIN_MS) continue
    seen.add(id)
    const inMs = src.mediaType === 'video' ? Math.max(0, int(o.inMs) ?? 0) : 0
    let durMs = Math.min(dur, INSERT_MAX_MS)
    if (src.mediaType === 'video' && src.durationMs) durMs = Math.min(durMs, Math.max(INSERT_MIN_MS, src.durationMs - inMs))
    out.push({
      id,
      sourceId: src.id,
      atSrcMs: Math.max(0, at),
      ...(o.append === true ? { append: true as const } : {}),
      inMs,
      durMs,
      ...(o.audio === 'mute' || src.mediaType === 'image' ? { audio: 'mute' as const } : {}),
      ...(o.fit === 'contain' ? { fit: 'contain' as const } : {}),
    })
    if (!youtubeLongForm && out.length >= MAX_INSERTS) break
  }
  return out.length ? out : undefined
}

export function insertAudio(ins: ClipInsert): InsertAudio {
  return ins.audio === 'mute' ? 'mute' : 'source'
}

/** Base (edit-timeline) output ms of a main-source point: inside a kept span → mapped; cut → next kept start. */
export function baseMsForSourcePoint(segs: readonly [number, number][], srcMs: number): number {
  let acc = 0
  for (const [a, b] of segs) {
    if (srcMs < a) return acc
    if (srcMs < b) return acc + (srcMs - a)
    acc += b - a
  }
  return acc
}

export type InsertWindow = {
  id: string
  sourceId: string
  /** Point on the edit timeline the insert sits at. */
  baseMs: number
  /** Start on the display / export timeline. */
  startMs: number
  endMs: number
  inMs: number
  durMs: number
  audio: InsertAudio
  fit: SourceFit
  /** G1b3: freeze frame (hold the frame at baseMs). */
  freeze?: true
  /** TC1: gap (black + silence). */
  gap?: true
}

/** Display windows in play order (worker parity: media_inserts.insert_windows). */
export function insertWindows(
  segs: readonly [number, number][],
  inserts: readonly ClipInsert[] | undefined,
): InsertWindow[] {
  if (!inserts?.length) return []
  const total = segs.reduce((s, [a, b]) => s + (b - a), 0)
  const placed = inserts.map((ins, order) => ({
    ins,
    order,
    baseMs: ins.append ? total : Math.min(total, baseMsForSourcePoint(segs, ins.atSrcMs)),
  }))
  // Appends after every anchored insert at the end; otherwise by point, ties in array order.
  placed.sort((x, y) => x.baseMs - y.baseMs || Number(Boolean(x.ins.append)) - Number(Boolean(y.ins.append)) || x.order - y.order)
  const out: InsertWindow[] = []
  let shift = 0
  for (const p of placed) {
    const startMs = p.baseMs + shift
    out.push({
      id: p.ins.id,
      sourceId: p.ins.sourceId,
      baseMs: p.baseMs,
      startMs,
      endMs: startMs + p.ins.durMs,
      inMs: p.ins.inMs,
      durMs: p.ins.durMs,
      audio: insertAudio(p.ins),
      fit: p.ins.fit ?? 'cover',
      ...(p.ins.sourceId === FREEZE_SOURCE_ID ? { freeze: true as const } : {}),
      ...(p.ins.sourceId === GAP_SOURCE_ID ? { gap: true as const } : {}),
    })
    shift += p.ins.durMs
  }
  return out
}

export function insertsTotalMs(inserts: readonly ClipInsert[] | undefined): number {
  return (inserts ?? []).reduce((s, i) => s + i.durMs, 0)
}

/** Edit-timeline ms → display ms (content at an insert point comes after the insert). */
export function baseToDisplayMs(windows: readonly InsertWindow[], baseMs: number): number {
  let shift = 0
  for (const w of windows) if (w.baseMs <= baseMs) shift += w.durMs
  return baseMs + shift
}

/** Display ms → edit-timeline ms, or the insert playing at that moment (offset into it). */
export function displayToBase(
  windows: readonly InsertWindow[],
  displayMs: number,
): { baseMs: number; insert: { id: string; offsetMs: number } | null } {
  let shift = 0
  for (const w of windows) {
    if (displayMs < w.startMs) break
    if (displayMs < w.endMs) return { baseMs: w.baseMs, insert: { id: w.id, offsetMs: displayMs - w.startMs } }
    shift += w.durMs
  }
  return { baseMs: Math.max(0, displayMs - shift), insert: null }
}

/** Shift edit-timeline [startMs, endMs) cues into display time (SRT / caption export). */
export function shiftCueToDisplay(windows: readonly InsertWindow[], startMs: number, endMs: number): [number, number] {
  return [baseToDisplayMs(windows, startMs), baseToDisplayMs(windows, Math.max(startMs, endMs - 1)) + 1]
}

export function addInsert(
  inserts: readonly ClipInsert[] | undefined,
  ins: ClipInsert,
): ClipInsert[] {
  return [...(inserts ?? []).filter((i) => i.id !== ins.id), ins].slice(0, MAX_INSERTS)
}

export function patchInsert(
  inserts: readonly ClipInsert[] | undefined,
  id: string,
  patch: Partial<Pick<ClipInsert, 'audio' | 'fit' | 'durMs' | 'inMs' | 'atSrcMs' | 'append'>>,
  sources: readonly ClipMediaSource[] | undefined,
): ClipInsert[] | undefined {
  const next = (inserts ?? []).map((i) => {
    if (i.id !== id) return i
    const merged: ClipInsert = { ...i, ...patch }
    if (patch.append === undefined && 'append' in patch) delete merged.append
    return merged
  })
  return normalizeInserts(next, sources)
}

export function removeInsert(inserts: readonly ClipInsert[] | undefined, id: string): ClipInsert[] | undefined {
  const next = (inserts ?? []).filter((i) => i.id !== id)
  return next.length ? next : undefined
}

export function isFreezeInsert(ins: Pick<ClipInsert, 'sourceId'>): boolean {
  return ins.sourceId === FREEZE_SOURCE_ID
}

/** G1b3: add a freeze frame at edit-timeline ms `baseMs` (anchored to the main source point there). */
export function addFreezeFrame(
  inserts: readonly ClipInsert[] | undefined,
  segs: readonly [number, number][],
  baseMs: number,
  id: string,
  durMs = FREEZE_DEFAULT_MS,
): ClipInsert[] | null {
  if ((inserts?.length ?? 0) >= MAX_INSERTS) return null
  const total = segs.reduce((s, [a, b]) => s + (b - a), 0)
  const t = Math.max(0, Math.min(total, Math.round(baseMs)))
  const ins: ClipInsert = { id, sourceId: FREEZE_SOURCE_ID, atSrcMs: 0, inMs: 0, durMs: Math.max(INSERT_MIN_MS, Math.round(durMs)), audio: 'mute' }
  if (t >= total) ins.append = true
  else {
    let acc = 0
    for (const [a, b] of segs) {
      if (t < acc + (b - a)) {
        ins.atSrcMs = a + (t - acc)
        break
      }
      acc += b - a
    }
  }
  return [...(inserts ?? []), ins]
}

export function isGapInsert(ins: Pick<ClipInsert, 'sourceId'>): boolean {
  return ins.sourceId === GAP_SOURCE_ID
}

/** Main-source anchor of edit-timeline ms `baseMs` (append when at / past the end). */
function anchorAt(segs: readonly [number, number][], baseMs: number): Pick<ClipInsert, 'atSrcMs' | 'append'> {
  const total = segs.reduce((s, [a, b]) => s + (b - a), 0)
  const t = Math.max(0, Math.min(total, Math.round(baseMs)))
  if (t >= total) return { atSrcMs: 0, append: true }
  let acc = 0
  for (const [a, b] of segs) {
    if (t < acc + (b - a)) return { atSrcMs: a + (t - acc) }
    acc += b - a
  }
  return { atSrcMs: 0, append: true }
}

/** TC1: insert a gap (black + silence) at edit-timeline ms `baseMs`. */
export function addGapAt(
  inserts: readonly ClipInsert[] | undefined,
  segs: readonly [number, number][],
  baseMs: number,
  id: string,
  durMs = GAP_DEFAULT_MS,
): ClipInsert[] | null {
  if ((inserts?.length ?? 0) >= MAX_INSERTS) return null
  const a = anchorAt(segs, baseMs)
  const ins: ClipInsert = {
    id,
    sourceId: GAP_SOURCE_ID,
    atSrcMs: a.atSrcMs,
    ...(a.append ? { append: true as const } : {}),
    inMs: 0,
    durMs: Math.min(INSERT_MAX_MS, Math.max(INSERT_MIN_MS, Math.round(durMs))),
    audio: 'mute',
  }
  return [...(inserts ?? []), ins]
}
