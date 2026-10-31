/**
 * G1c source monitor: build from an uploaded file's transcript (three-point Insert / Overwrite at
 * the playhead) and match frame (F: the source media at the playhead's moment). Pure, manual —
 * the transcript is the E5b one already bought; nothing here calls AI or spends credits.
 */
import { DEFAULT_SFX_VOLUME } from '@/lib/clips/audio'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { outputToSource, type Timebase } from '@/lib/clips/editor/clip-timeline'
import { addInsert, INSERT_MAX_MS, INSERT_MIN_MS, normalizeInserts, type ClipInsert } from '@/lib/clips/editor/inserts'
import { sfxPlacementId, sourceFromItem, type AddResult, type ProjectMediaItem } from '@/lib/clips/editor/media-add'
import type { MediaTranscriptWord } from '@/lib/clips/editor/media-words'
import { normalizeSourceSegments, SOURCE_SEG_MIN_MS, sourceById, sourceSegmentAt, upsertSource, clearSourceRange, type SourceSegment } from '@/lib/clips/editor/sources'
import { effectiveTracks, trackIdOf } from '@/lib/clips/editor/tracks'

export type TranscriptLine = { i0: number; i1: number; startMs: number; endMs: number; text: string }

/** Lines for the monitor: a sentence end, a > 0.8 s pause, or 18 words closes a line. */
export function transcriptLines(words: readonly MediaTranscriptWord[], pauseS = 0.8, maxWords = 18): TranscriptLine[] {
  const out: TranscriptLine[] = []
  let i0 = 0
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    const next = words[i + 1]
    const end = !next || /[.!?]["')\]]?$/.test(w.w) || next.s - w.e > pauseS || i - i0 + 1 >= maxWords
    if (end) {
      out.push({
        i0,
        i1: i,
        startMs: Math.round(words[i0]!.s * 1000),
        endMs: Math.round(w.e * 1000),
        text: words.slice(i0, i + 1).map((x) => x.w).join(' '),
      })
      i0 = i + 1
    }
  }
  return out
}

/** Media-ms range of words [i0, i1] (inclusive), padded so first / last syllables aren't clipped. */
export function wordRangeMs(words: readonly MediaTranscriptWord[], i0: number, i1: number, padMs = 60, mediaMs?: number | null): [number, number] | null {
  const a = Math.min(i0, i1)
  const b = Math.max(i0, i1)
  if (a < 0 || b >= words.length) return null
  const s = Math.max(0, Math.round(words[a]!.s * 1000) - padMs)
  let e = Math.round(words[b]!.e * 1000) + padMs
  if (mediaMs && mediaMs > 0) e = Math.min(e, mediaMs)
  return e > s ? [s, e] : null
}

/**
 * Insert (ripple): the range plays at the playhead, everything after moves right.
 * Video → an E5b insert with in-point; audio → an audio-track item at the playhead (no ripple).
 */
export function insertFromSource(
  edits: ClipEditsV2,
  item: ProjectMediaItem,
  tb: Timebase,
  playheadOutMs: number,
  range: [number, number],
  newId: () => string,
): AddResult {
  const dur = Math.round(range[1] - range[0])
  if (item.isMain) return { edits: null, message: 'The main video is already the timeline — edit it in the transcript' }
  if (item.mediaType === 'image') return { edits: null, message: 'Images have no transcript' }
  if (item.mediaType === 'audio') {
    const audio = edits.audio ?? { music: null, sfx: [] }
    const generationId = sfxPlacementId(item.refId, audio.sfx.map((s) => s.generationId))
    return {
      edits: {
        ...edits,
        audio: { ...audio, sfx: [...audio.sfx, { generationId, uploadId: item.refId, atMs: Math.round(Math.max(0, playheadOutMs)), volume: DEFAULT_SFX_VOLUME, ...(range[0] > 0 ? { inMs: Math.round(range[0]) } : {}), durMs: dur }] },
      },
      message: `Placed ${(dur / 1000).toFixed(1)} s on the audio track`,
    }
  }
  if (dur < INSERT_MIN_MS) return { edits: null, message: 'Selection too short' }
  if (dur > INSERT_MAX_MS) return { edits: null, message: `Select under ${Math.round(INSERT_MAX_MS / 1000)} s` }
  const { syncMs: _s, ...src } = sourceFromItem(item)
  const { sources, id } = upsertSource(edits.sources, src)
  const atSrc = Math.round(Math.max(edits.trim.in, Math.min(edits.trim.out, outputToSource(tb, playheadOutMs))))
  const ins: ClipInsert = { id: newId(), sourceId: id, atSrcMs: atSrc, inMs: Math.round(range[0]), durMs: dur }
  const inserts = normalizeInserts(addInsert(edits.inserts, ins), sources)
  if (!inserts?.some((i) => i.id === ins.id)) return { edits: null, message: 'Could not insert here' }
  return { edits: { ...edits, sources, inserts }, message: `Inserted ${(dur / 1000).toFixed(1)} s` }
}

/**
 * Overwrite (no ripple): from the playhead, the Video lane shows the range (its own sound) for
 * the same length, across cuts. Length = min(selection, what's left after the playhead).
 */
export function overwriteFromSource(
  edits: ClipEditsV2,
  item: ProjectMediaItem,
  tb: Timebase,
  playheadOutMs: number,
  range: [number, number],
  newId: () => string,
): AddResult {
  if (item.isMain || item.mediaType !== 'video') return { edits: null, message: 'Overwrite needs a video upload or angle' }
  const { sources, id } = upsertSource(edits.sources, sourceFromItem(item))
  let left = Math.round(range[1] - range[0])
  let inMs = Math.round(range[0])
  let segs: SourceSegment[] = [...(edits.sourceSegments ?? [])]
  const added: SourceSegment[] = []
  for (let k = 0; k < tb.segs.length && left > 0; k++) {
    const [a, b] = tb.segs[k]!
    const s0 = tb.starts[k]!
    const s1 = s0 + (b - a)
    if (s1 <= playheadOutMs) continue
    const from = a + Math.max(0, playheadOutMs - s0)
    const to = Math.min(b, from + left)
    if (to - from >= SOURCE_SEG_MIN_MS) {
      // Explicit inMs = unsynced playback (media_sources.is_synced), so angles work too.
      const seg: SourceSegment = { id: newId(), sourceId: id, startMs: Math.round(from), endMs: Math.round(to), inMs, audio: 'source' }
      segs = clearSourceRange(segs, seg.startMs, seg.endMs) ?? []
      segs.push(seg)
      added.push(seg)
    }
    left -= to - from
    inMs += Math.round(to - from)
  }
  if (!added.length) return { edits: null, message: 'Nothing after the playhead to overwrite' }
  const sourceSegments = normalizeSourceSegments(segs, sources)
  const total = added.reduce((n, s) => n + (s.endMs - s.startMs), 0)
  return { edits: { ...edits, sources, sourceSegments }, message: `Overwrote ${(total / 1000).toFixed(1)} s` }
}

export type MatchFrame = { itemId: string; mediaMs: number; via: 'broll' | 'segment' | 'main' }

/**
 * Match frame: the media item + media ms under the playhead — the top B-roll upload if one is on
 * screen, else the Video lane's angle / replacement, else the main source.
 */
export function matchFrameAt(edits: ClipEditsV2, tb: Timebase, outMs: number, items: readonly ProjectMediaItem[]): MatchFrame | null {
  const t = Math.max(0, outMs)
  const tracks = effectiveTracks(edits)
  const order = new Map(tracks.filter((x) => x.kind === 'overlay').map((x, i) => [x.id, i]))
  const hits = (edits.broll ?? [])
    .filter((b) => b.source === 'upload' && t >= b.startMs && t < b.endMs)
    .sort((x, y) => (order.get(trackIdOf(edits, 'overlay', x.id, tracks)) ?? 0) - (order.get(trackIdOf(edits, 'overlay', y.id, tracks)) ?? 0) || y.startMs - x.startMs)
  for (const b of hits) {
    if (b.source !== 'upload') continue
    const it = items.find((i) => i.ref === 'upload' && i.refId === b.uploadId)
    if (it) return { itemId: it.id, mediaMs: Math.round((b.inMs ?? 0) + (b.still ? 0 : t - b.startMs)), via: 'broll' }
  }
  if (!tb.segs.length) return null
  const src = outputToSource(tb, t)
  const seg = sourceSegmentAt(edits.sourceSegments, src)
  if (seg) {
    const s = sourceById(edits.sources, seg.sourceId)
    const it = s ? items.find((i) => i.refId === s.refId && i.ref === s.ref) : undefined
    if (it) {
      const synced = s!.mediaType === 'video' && s!.syncMs !== undefined && seg.inMs === undefined
      const ms = s!.mediaType === 'image' ? 0 : synced ? src + s!.syncMs! : (seg.inMs ?? 0) + (src - seg.startMs)
      return { itemId: it.id, mediaMs: Math.max(0, Math.round(ms)), via: 'segment' }
    }
  }
  const main = items.find((i) => i.isMain)
  return main ? { itemId: main.id, mediaMs: Math.round(src), via: 'main' } : null
}
