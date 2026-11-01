/**
 * E5 multiple sources per clip (Media panel uploads, Rooms angles, multicam).
 *
 * Model (additive, edits JSON):
 * - `edits.sources`: media a clip references, by ref ('upload' = ClipUpload id registered in the
 *   project's media library, 'take' = Rooms RecordingTrack id of the project's take).
 * - `edits.sourceSegments`: Video-lane segments whose picture (and optionally sound) comes from
 *   another source. Source-anchored like E4 color / speed: a segment covers MAIN SOURCE ms
 *   [startMs, endMs), so it survives ripple, reorder, silence trim and per-item speed, and the
 *   output timeline (captions, transcript, every lane) never changes. The main source keeps the
 *   transcript; captions keep following the main audio.
 * - Media time inside a segment: synced angle (source.syncMs set, no inMs) = main ms + syncMs;
 *   otherwise inMs + (main ms − startMs). Images are stills (frame 0) for the segment's span.
 * - `edits.multicam`: speaker → source map + cut rhythm for the EXISTING active-speaker rules
 *   (lib/clips/script-editor/multicam-scenes.ts, D8). Generated segments carry `auto: true`.
 *
 * No runtime imports except the shared multicam rules, so lib/clips/edits.ts can use it.
 * Mirrored by worker clips_worker/media_sources.py.
 */
import { buildAutoMulticamScenes } from '@/lib/clips/script-editor/multicam-scenes'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

export type MediaType = 'video' | 'image' | 'audio'
export type MediaRef = 'upload' | 'take'
export type SourceAudio = 'main' | 'source' | 'mix'
export type SourceFit = 'cover' | 'contain'

export type ClipMediaSource = {
  /** Stable id inside the clip (= refId; one entry per media). */
  id: string
  ref: MediaRef
  refId: string
  mediaType: MediaType
  label?: string
  durationMs?: number
  /** Angle sync: media ms = main source ms + syncMs (Rooms clock offset or audio-sync result). */
  syncMs?: number
}

export type SourceSegment = {
  id: string
  sourceId: string
  /** MAIN SOURCE ms span the segment replaces on the Video lane. */
  startMs: number
  endMs: number
  /** Media in-point at startMs (unsynced media). Ignored for synced angles and images. */
  inMs?: number
  /** Sound in the span: main track (default for angles / images), the clip's own, or both. */
  audio?: SourceAudio
  /** Mixed sizes: crop to fill (default) or fit with padding. */
  fit?: SourceFit
  /** Created by multicam auto-switch (regenerating replaces only these). */
  auto?: true
}

export type ClipMulticam = {
  /** Diarized speaker (ClipWord.spk, as string) → source id; missing / 'main' = main camera. */
  speakerSources?: Record<string, string>
  minHoldMs?: number
  wideEveryMs?: number
}

export const SOURCE_SEG_MIN_MS = 100
export const IMAGE_DEFAULT_MS = 3000
export const MAX_SOURCES = 50
export const MAX_SOURCE_SEGMENTS = 500
export const MULTICAM_MIN_HOLD_RANGE: readonly [number, number] = [2000, 10_000]
export const MULTICAM_WIDE_EVERY_RANGE: readonly [number, number] = [5_000, 120_000]

const MEDIA_TYPES = new Set<MediaType>(['video', 'image', 'audio'])
const AUDIO_MODES = new Set<SourceAudio>(['main', 'source', 'mix'])

function int(v: unknown): number | undefined {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? n : undefined
}

function safeId(v: unknown): string {
  const s = String(v ?? '').trim()
  return /^[A-Za-z0-9_:.~-]{1,120}$/.test(s) ? s : ''
}

export function normalizeMediaSources(raw: unknown): ClipMediaSource[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ClipMediaSource[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const refId = safeId(o.refId)
    const id = safeId(o.id) || refId
    const ref: MediaRef | null = o.ref === 'upload' || o.ref === 'take' ? o.ref : null
    const mediaType = MEDIA_TYPES.has(o.mediaType as MediaType) ? (o.mediaType as MediaType) : null
    if (!id || !refId || !ref || !mediaType || seen.has(id)) continue
    seen.add(id)
    const durationMs = int(o.durationMs)
    const syncMs = int(o.syncMs)
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, 120) : ''
    out.push({
      id,
      ref,
      refId,
      mediaType,
      ...(label ? { label } : {}),
      ...(durationMs !== undefined && durationMs > 0 ? { durationMs } : {}),
      ...(syncMs !== undefined && mediaType !== 'image' ? { syncMs } : {}),
    })
    if (out.length >= MAX_SOURCES) break
  }
  return out.length ? out : undefined
}

/**
 * G1b3: a manual "back to the main camera" span is STORED as a placeholder segment with this
 * sourceId, so a later auto-switch (applyMulticamSegments keeps manual spans) never cuts there.
 * It renders as the main picture: preview / export ignore it (worker media_sources drops it).
 */
export const MAIN_SOURCE_ID = 'main'

export function isMainPlaceholder(s: Pick<SourceSegment, 'sourceId'>): boolean {
  return s.sourceId === MAIN_SOURCE_ID
}

/** Sorted, non-overlapping (a later segment wins from its start), known video / image / audio sources. */
export function normalizeSourceSegments(
  raw: unknown,
  sources: readonly ClipMediaSource[] | undefined,
): SourceSegment[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const byId = new Map((sources ?? []).map((s) => [s.id, s]))
  const out: SourceSegment[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = safeId(o.id)
    const a = int(o.startMs)
    const b = int(o.endMs)
    if (safeId(o.sourceId) === MAIN_SOURCE_ID && o.auto !== true) {
      if (id && a !== undefined && b !== undefined && a >= 0 && b - a >= SOURCE_SEG_MIN_MS) {
        out.push({ id, sourceId: MAIN_SOURCE_ID, startMs: a, endMs: b })
      }
      continue
    }
    const src = byId.get(safeId(o.sourceId))
    if (!id || !src || a === undefined || b === undefined) continue
    if (src.mediaType === 'audio' && o.auto === true) continue
    if (b - a < SOURCE_SEG_MIN_MS || a < 0) continue
    const inMs = int(o.inMs)
    out.push({
      id,
      sourceId: src.id,
      startMs: a,
      endMs: b,
      ...(inMs !== undefined && inMs >= 0 && (src.mediaType === 'video' || src.mediaType === 'audio') ? { inMs } : {}),
      ...(AUDIO_MODES.has(o.audio as SourceAudio) && src.mediaType === 'video' ? { audio: o.audio as SourceAudio } : {}),
      ...(src.mediaType === 'audio' ? { audio: 'source' as const } : {}),
      ...(o.fit === 'contain' ? { fit: 'contain' as const } : {}),
      ...(o.auto === true ? { auto: true as const } : {}),
    })
  }
  out.sort((x, y) => x.startMs - y.startMs)
  const clean: SourceSegment[] = []
  for (const s of out) {
    const prev = clean[clean.length - 1]
    if (prev && prev.endMs > s.startMs) {
      prev.endMs = s.startMs
      if (prev.endMs - prev.startMs < SOURCE_SEG_MIN_MS) clean.pop()
    }
    clean.push({ ...s })
    if (clean.length >= MAX_SOURCE_SEGMENTS) break
  }
  return clean.length ? clean : undefined
}

export function normalizeMulticam(raw: unknown): ClipMulticam | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const map: Record<string, string> = {}
  if (o.speakerSources && typeof o.speakerSources === 'object') {
    for (const [k, v] of Object.entries(o.speakerSources as Record<string, unknown>)) {
      const key = String(k).slice(0, 16)
      const val = safeId(v)
      if (/^\d{1,3}$/.test(key) && val) map[key] = val
    }
  }
  const clampR = (v: unknown, [lo, hi]: readonly [number, number]) => {
    const n = int(v)
    return n === undefined ? undefined : Math.min(hi, Math.max(lo, n))
  }
  const minHoldMs = clampR(o.minHoldMs, MULTICAM_MIN_HOLD_RANGE)
  const wideEveryMs = clampR(o.wideEveryMs, MULTICAM_WIDE_EVERY_RANGE)
  const res: ClipMulticam = {
    ...(Object.keys(map).length ? { speakerSources: map } : {}),
    ...(minHoldMs !== undefined ? { minHoldMs } : {}),
    ...(wideEveryMs !== undefined ? { wideEveryMs } : {}),
  }
  return Object.keys(res).length ? res : undefined
}

export function sourceById(sources: readonly ClipMediaSource[] | undefined, id: string): ClipMediaSource | undefined {
  return (sources ?? []).find((s) => s.id === id)
}

export function sourceSegmentAt(segs: readonly SourceSegment[] | undefined, srcMs: number): SourceSegment | undefined {
  for (const s of segs ?? []) if (srcMs >= s.startMs && srcMs < s.endMs) return isMainPlaceholder(s) ? undefined : s
  return undefined
}

export function isSynced(seg: SourceSegment, source: ClipMediaSource | undefined): boolean {
  return Boolean(source && source.mediaType === 'video' && source.syncMs !== undefined && seg.inMs === undefined)
}

/** Media ms of `source` shown at main source ms `srcMs` inside `seg`. */
export function segmentMediaMs(seg: SourceSegment, source: ClipMediaSource | undefined, srcMs: number): number {
  if (!source || source.mediaType === 'image') return 0
  if (isSynced(seg, source)) return Math.max(0, srcMs + (source.syncMs ?? 0))
  return Math.max(0, (seg.inMs ?? 0) + (srcMs - seg.startMs))
}

export function segmentAudio(seg: SourceSegment, source: ClipMediaSource | undefined): SourceAudio {
  if (!source) return 'main'
  if (source.mediaType === 'audio') return 'source'
  if (source.mediaType !== 'video') return 'main'
  if (seg.audio) return seg.audio
  return isSynced(seg, source) ? 'main' : 'source'
}

/** Put `seg` over its span; overlapped segments are cut around it (right pieces keep their media). */
export function setSourceSegment(
  segs: readonly SourceSegment[] | undefined,
  seg: SourceSegment,
  sources: readonly ClipMediaSource[] | undefined,
): SourceSegment[] | undefined {
  const next = clearSourceRange(segs, seg.startMs, seg.endMs) ?? []
  next.push(seg)
  return normalizeSourceSegments(next, sources)
}

export function clearSourceRange(
  segs: readonly SourceSegment[] | undefined,
  fromMs: number,
  toMs: number,
): SourceSegment[] | undefined {
  const next: SourceSegment[] = []
  for (const s of segs ?? []) {
    if (s.endMs <= fromMs || s.startMs >= toMs) {
      next.push(s)
      continue
    }
    if (s.startMs < fromMs) next.push({ ...s, endMs: fromMs })
    if (s.endMs > toMs) {
      const shift = toMs - s.startMs
      next.push({
        ...s,
        id: `${s.id}~${Math.round(toMs)}`.slice(0, 120),
        startMs: toMs,
        ...(s.inMs !== undefined ? { inMs: s.inMs + shift } : {}),
      })
    }
  }
  return next.length ? next : undefined
}

export function removeSourceSegment(segs: readonly SourceSegment[] | undefined, id: string): SourceSegment[] | undefined {
  const next = (segs ?? []).filter((s) => s.id !== id)
  return next.length ? next : undefined
}

export function patchSourceSegment(
  segs: readonly SourceSegment[] | undefined,
  id: string,
  patch: Partial<Pick<SourceSegment, 'audio' | 'fit' | 'inMs' | 'startMs' | 'endMs'>>,
  sources: readonly ClipMediaSource[] | undefined,
): SourceSegment[] | undefined {
  const cur = (segs ?? []).find((s) => s.id === id)
  if (!cur) return segs ? [...segs] : undefined
  const { auto: _auto, ...rest } = cur
  const merged: SourceSegment = { ...rest, ...patch }
  if (patch.inMs === undefined && 'inMs' in patch) delete merged.inMs
  const others = (segs ?? []).filter((s) => s.id !== id)
  return setSourceSegment(others, merged, sources)
}

/** Add (or refresh) a source entry; returns the next list and the source id. */
export function upsertSource(
  sources: readonly ClipMediaSource[] | undefined,
  src: ClipMediaSource,
): { sources: ClipMediaSource[]; id: string } {
  const list = [...(sources ?? [])]
  const i = list.findIndex((s) => s.id === src.id)
  if (i >= 0) list[i] = { ...list[i]!, ...src }
  else list.push(src)
  return { sources: normalizeMediaSources(list) ?? [], id: src.id }
}

/** Drop sources nothing references any more (segments / multicam map / E5b inserts). */
export function pruneSources(
  sources: readonly ClipMediaSource[] | undefined,
  segs: readonly SourceSegment[] | undefined,
  multicam?: ClipMulticam,
  inserts?: readonly { sourceId: string }[],
): ClipMediaSource[] | undefined {
  const used = new Set((segs ?? []).map((s) => s.sourceId))
  for (const i of inserts ?? []) used.add(i.sourceId)
  for (const v of Object.values(multicam?.speakerSources ?? {})) used.add(v)
  const next = (sources ?? []).filter((s) => used.has(s.id))
  return next.length ? next : undefined
}

// ---------------------------------------------------------------------------
// Multicam: the EXISTING D8 active-speaker rules → source segments
// ---------------------------------------------------------------------------

export type MulticamWord = { s: number; e: number; spk?: number; i?: number }

/**
 * Speaker-switched segments over MAIN SOURCE [rangeStartMs, rangeEndMs) (the clip's keep window).
 * Switch points are the first word of each scene (word start, ms), so cuts land on the diarization
 * boundary. 'grid' (wide / overlap / short turn) and unmapped speakers stay on the main camera.
 */
export function buildMulticamSegments(
  words: readonly MulticamWord[],
  rangeStartMs: number,
  rangeEndMs: number,
  multicam: ClipMulticam | undefined,
  sources: readonly ClipMediaSource[] | undefined,
): SourceSegment[] {
  const map = multicam?.speakerSources ?? {}
  const inRange = words
    .filter((w) => w.e * 1000 > rangeStartMs && w.s * 1000 < rangeEndMs)
    .sort((a, b) => a.s - b.s)
  if (!inRange.length) return []
  const editorWords: EditorWord[] = inRange.map((w, k) => ({
    id: `w${w.i ?? k}`,
    index: k,
    t0Ms: Math.round(w.s * 1000),
    t1Ms: Math.round(w.e * 1000),
    text: '',
    speakerId: `spk:${w.spk ?? 0}`,
  }))
  const startById = new Map(editorWords.map((w) => [w.id, w.t0Ms]))
  const scenes = buildAutoMulticamScenes(editorWords, {
    ...(multicam?.minHoldMs ? { minHoldMs: multicam.minHoldMs } : {}),
    ...(multicam?.wideEveryMs ? { wideEveryMs: multicam.wideEveryMs } : {}),
  })
  const known = new Set((sources ?? []).filter((s) => s.mediaType === 'video').map((s) => s.id))
  const out: SourceSegment[] = []
  scenes.forEach((sc, k) => {
    const a = Math.max(rangeStartMs, k === 0 ? rangeStartMs : startById.get(sc.startWordId) ?? rangeStartMs)
    const nextStart = k + 1 < scenes.length ? startById.get(scenes[k + 1]!.startWordId) : undefined
    const b = Math.min(rangeEndMs, nextStart ?? rangeEndMs)
    if (!sc.layoutId.startsWith('speaker:')) return
    const spk = sc.layoutId.slice('speaker:'.length)
    const sourceId = map[spk]
    if (!sourceId || sourceId === 'main' || !known.has(sourceId) || b - a < SOURCE_SEG_MIN_MS) return
    out.push({ id: `mc_${a}`, sourceId, startMs: a, endMs: b, audio: 'main', auto: true })
  })
  return out
}

/** Replace previous auto segments in the range with freshly generated ones; manual segments win. */
export function applyMulticamSegments(
  segs: readonly SourceSegment[] | undefined,
  generated: readonly SourceSegment[],
  rangeStartMs: number,
  rangeEndMs: number,
  sources: readonly ClipMediaSource[] | undefined,
): SourceSegment[] | undefined {
  const manual = (segs ?? []).filter((s) => !s.auto)
  const keptAuto = (segs ?? []).filter((s) => s.auto && (s.endMs <= rangeStartMs || s.startMs >= rangeEndMs))
  let next: SourceSegment[] | undefined = [...keptAuto]
  for (const g of generated) {
    // Auto cuts never cover a manual segment.
    let pieces: SourceSegment[] = [g]
    for (const m of manual) {
      pieces = pieces.flatMap((p) => {
        if (p.endMs <= m.startMs || p.startMs >= m.endMs) return [p]
        const res: SourceSegment[] = []
        if (p.startMs < m.startMs) res.push({ ...p, endMs: m.startMs })
        if (p.endMs > m.endMs) res.push({ ...p, id: `${p.id}~${m.endMs}`, startMs: m.endMs })
        return res
      })
    }
    next = [...(next ?? []), ...pieces]
  }
  return normalizeSourceSegments([...manual, ...(next ?? [])], sources)
}

/** MC-08: active-speaker auto cuts in gaps only; manual `sourceSegments` (no `auto`) are kept. */
export function fillActiveSpeakerGaps(
  edits: ClipEditsV2,
  words: readonly MulticamWord[],
  rangeStartMs: number,
  rangeEndMs: number,
): { edits: ClipEditsV2; generated: SourceSegment[] } {
  const multicam = edits.multicam
  const sources = edits.sources
  const generated = buildMulticamSegments(words, rangeStartMs, rangeEndMs, multicam, sources)
  const sourceSegments = applyMulticamSegments(edits.sourceSegments, generated, rangeStartMs, rangeEndMs, sources)
  return { edits: { ...edits, sourceSegments }, generated }
}

/** Speakers present in the words (for the speaker → camera map), most talkative first. */
export function speakersInWords(words: readonly MulticamWord[], rangeStartMs: number, rangeEndMs: number): string[] {
  const talk = new Map<string, number>()
  for (const w of words) {
    if (w.e * 1000 <= rangeStartMs || w.s * 1000 >= rangeEndMs) continue
    const k = String(w.spk ?? 0)
    talk.set(k, (talk.get(k) ?? 0) + (w.e - w.s))
  }
  return [...talk.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
}

// ---------------------------------------------------------------------------
// Timeline / export windows
// ---------------------------------------------------------------------------

/** Output-ms pieces of each segment on the Video lane (a segment spanning a cut shows twice). */
export function sourceSegmentWindows(
  tb: { segs: [number, number][]; starts: number[] },
  segs: readonly SourceSegment[] | undefined,
): { id: string; sourceId: string; startMs: number; endMs: number; srcStartMs: number; srcEndMs: number }[] {
  const out: { id: string; sourceId: string; startMs: number; endMs: number; srcStartMs: number; srcEndMs: number }[] = []
  for (const s of segs ?? []) {
    tb.segs.forEach(([a, b], i) => {
      const lo = Math.max(a, s.startMs)
      const hi = Math.min(b, s.endMs)
      if (hi - lo < 1) return
      const o0 = tb.starts[i]! + (lo - a)
      out.push({ id: s.id, sourceId: s.sourceId, startMs: o0, endMs: o0 + (hi - lo), srcStartMs: lo, srcEndMs: hi })
    })
  }
  return out.sort((x, y) => x.startMs - y.startMs)
}

/** Export spec over a source-time render window (worker parity: media_sources.source_windows). */
export function sourceRenderWindows(
  edits: { sources?: ClipMediaSource[]; sourceSegments?: SourceSegment[] },
  windowStartMs: number,
  windowEndMs: number,
): { id: string; sourceId: string; t0Ms: number; t1Ms: number; mediaInMs: number; audio: SourceAudio; fit: SourceFit; mediaType: MediaType }[] {
  const out: { id: string; sourceId: string; t0Ms: number; t1Ms: number; mediaInMs: number; audio: SourceAudio; fit: SourceFit; mediaType: MediaType }[] = []
  for (const s of edits.sourceSegments ?? []) {
    const src = sourceById(edits.sources, s.sourceId)
    if (!src) continue
    const lo = Math.max(windowStartMs, s.startMs)
    const hi = Math.min(windowEndMs, s.endMs)
    if (hi - lo < 1) continue
    out.push({
      id: s.id,
      sourceId: s.sourceId,
      t0Ms: lo - windowStartMs,
      t1Ms: hi - windowStartMs,
      mediaInMs: segmentMediaMs(s, src, lo),
      audio: segmentAudio(s, src),
      fit: s.fit ?? 'cover',
      mediaType: src.mediaType,
    })
  }
  return out
}
