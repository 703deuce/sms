/**
 * E5 Media panel → timeline: one pure function per lane so "Add to timeline" and drag-and-drop
 * produce the same edit (one undo step). Upload items come from the project media library
 * (GET /api/clips/projects/[id]/library); Rooms angles arrive as ref 'take'.
 */
import { BROLL_MIN_MS, brollInsertWindow, toIntMs, type BrollItem } from '@/lib/clips/broll'
import { DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME } from '@/lib/clips/audio'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { outputToSource, type Timebase } from '@/lib/clips/editor/clip-timeline'
import { isDefaultTrackId, setItemsTrack } from '@/lib/clips/editor/tracks'
import { addMusicClip } from '@/lib/clips/editor/audio-clip'
import {
  IMAGE_DEFAULT_MS,
  SOURCE_SEG_MIN_MS,
  setSourceSegment,
  upsertSource,
  type ClipMediaSource,
  type MediaRef,
  type MediaType,
} from '@/lib/clips/editor/sources'
import {
  INSERT_IMAGE_DEFAULT_MS,
  INSERT_MAX_MS,
  INSERT_MIN_MS,
  addInsert,
  normalizeInserts,
  type ClipInsert,
} from '@/lib/clips/editor/inserts'

export type ProjectMediaItem = {
  /** Library row id (upload) or `take:<trackId>`. */
  id: string
  ref: MediaRef
  /** ClipUpload id or RecordingTrack id. */
  refId: string
  mediaType: MediaType
  label: string
  durationMs: number | null
  width: number | null
  height: number | null
  /** Signed URL (1 h) for preview / thumbnails. */
  url: string | null
  /** Angle sync (media ms = main ms + syncMs) — Rooms clock or audio sync result. */
  syncMs: number | null
  syncStatus: 'none' | 'clock' | 'queued' | 'done' | 'failed' | 'low_confidence'
  syncConfidence?: number | null
  /** True when this is the project's main source (not addable as an angle). */
  isMain?: boolean
}

export type MediaDropLane = 'video' | 'broll' | 'music' | 'sfx'
export const MEDIA_DND_TYPE = 'application/x-clip-media'

export function mediaLanesFor(item: Pick<ProjectMediaItem, 'mediaType' | 'ref' | 'isMain'>): MediaDropLane[] {
  if (item.isMain) return []
  if (item.mediaType === 'audio') return item.ref === 'upload' ? ['music', 'sfx'] : []
  if (item.ref === 'take') return ['video']
  return ['video', 'broll']
}

/**
 * FV4e: lanes a media item may be DROPPED on (timeline drag-and-drop). Same as the card buttons,
 * plus an uploaded video on the Music / SFX lanes — its sound only (preview plays the file in an
 * <audio>, the worker reads its audio stream like the G1b3 detached clip audio).
 */
export function mediaDropLanesFor(item: Pick<ProjectMediaItem, 'mediaType' | 'ref' | 'isMain'>): MediaDropLane[] {
  const lanes = mediaLanesFor(item)
  if (!item.isMain && item.ref === 'upload' && item.mediaType === 'video') return [...lanes, 'music', 'sfx']
  return lanes
}

export function sourceFromItem(item: ProjectMediaItem): ClipMediaSource {
  return {
    id: item.refId,
    ref: item.ref,
    refId: item.refId,
    mediaType: item.mediaType,
    label: item.label.slice(0, 120),
    ...(item.durationMs ? { durationMs: item.durationMs } : {}),
    ...(item.syncMs != null && item.mediaType === 'video' ? { syncMs: item.syncMs } : {}),
  }
}

function mediaLenMs(item: ProjectMediaItem, fallback: number): number {
  if (item.mediaType === 'image') return IMAGE_DEFAULT_MS
  return item.durationMs && item.durationMs > 0 ? item.durationMs : fallback
}

export type AddResult = { edits: ClipEditsV2; message?: string } | { edits: null; message: string }

/**
 * Add at OUTPUT ms `atMs` on `lane`.
 * - video: a source segment from the playhead to the end of the media (stills 3 s, synced angles to
 *   the end of the Video item), never past the Video item under the playhead.
 * - broll: an upload B-roll item (video or still) at the playhead.
 * - music: the music bed; G2: when one is already there, a music-style clip on a "Music N" track.
 * - sfx: one cue at the playhead.
 */
/**
 * G1b3: media dropped on an EXTRA track row lands on that track — the items the add created
 * (new B-roll / SFX ids) are assigned to `trackId` (default track / unknown id: unchanged).
 */
export function placeAddedOnTrack(prev: ClipEditsV2, next: ClipEditsV2, lane: MediaDropLane, trackId: string | undefined): ClipEditsV2 {
  if (!trackId || isDefaultTrackId(trackId)) return next
  if (lane === 'broll') {
    const had = new Set((prev.broll ?? []).map((b) => b.id))
    const ids = (next.broll ?? []).filter((b) => !had.has(b.id)).map((b) => b.id)
    return setItemsTrack(next, 'overlay', ids, trackId) ?? next
  }
  if (lane === 'sfx') {
    const had = new Set((prev.audio?.sfx ?? []).map((c) => c.generationId))
    const ids = (next.audio?.sfx ?? []).filter((c) => !had.has(c.generationId)).map((c) => c.generationId)
    return setItemsTrack(next, 'audio', ids, trackId) ?? next
  }
  return next
}

export function addMediaToLane(
  edits: ClipEditsV2,
  tb: Timebase,
  item: ProjectMediaItem,
  lane: MediaDropLane,
  atMs: number,
  newId: () => string,
): AddResult {
  if (!mediaDropLanesFor(item).includes(lane)) {
    return { edits: null, message: `${item.mediaType === 'audio' ? 'Audio' : 'This media'} can't go on the ${lane} lane` }
  }
  const outMs = Math.max(0, Math.min(tb.durationMs, toIntMs(atMs)))
  if (lane === 'video') {
    const srcMs = outputToSource(tb, outMs)
    const k = tb.segs.findIndex(([a, b]) => srcMs >= a && srcMs < b)
    if (k < 0) return { edits: null, message: 'Move the playhead onto the clip first' }
    const segEnd = tb.segs[k]![1]
    const synced = item.syncMs != null && item.mediaType === 'video'
    const len = synced ? segEnd - srcMs : mediaLenMs(item, segEnd - srcMs)
    const endMs = Math.min(segEnd, srcMs + len)
    if (endMs - srcMs < SOURCE_SEG_MIN_MS) return { edits: null, message: 'Not enough room at the playhead' }
    const { sources, id } = upsertSource(edits.sources, sourceFromItem(item))
    const seg = {
      id: newId(),
      sourceId: id,
      startMs: Math.round(srcMs),
      endMs: Math.round(endMs),
      ...(synced || item.mediaType === 'image' ? {} : { inMs: 0 }),
    }
    return { edits: { ...edits, sources, sourceSegments: setSourceSegment(edits.sourceSegments, seg, sources) } }
  }
  if (lane === 'broll') {
    const win = brollInsertWindow(outMs, tb.durationMs, mediaLenMs(item, 3000))
    if (win.endMs - win.startMs < BROLL_MIN_MS) return { edits: null, message: 'Not enough room at the playhead' }
    const b: BrollItem = {
      id: newId(),
      source: 'upload',
      uploadId: item.refId,
      ...(item.mediaType === 'image' ? { still: true as const } : {}),
      startMs: win.startMs,
      endMs: win.endMs,
      placement: 'manual',
    }
    return { edits: { ...edits, broll: [...(edits.broll ?? []), b] } }
  }
  const audio = edits.audio ?? { music: null, sfx: [] }
  if (lane === 'music') {
    const len = mediaLenMs(item, tb.durationMs)
    if (audio.music && audio.music.generationId !== item.refId) {
      // G2: a second song never replaces the first — it lands on a "Music 2" audio track.
      const generationId = sfxPlacementId(item.refId, audio.sfx.map((s) => s.generationId))
      const r = addMusicClip(edits, { generationId, uploadId: item.refId, atMs: outMs, lenMs: len, durationMs: tb.durationMs })
      if (!r) return { edits: null, message: 'Not enough room at the playhead' }
      return { edits: r.edits, message: `Added on ${r.trackName} (the Music track already has a song)` }
    }
    return {
      edits: {
        ...edits,
        audio: {
          ...audio,
          music: {
            generationId: item.refId,
            uploadId: item.refId,
            volume: audio.music?.volume ?? DEFAULT_MUSIC_VOLUME,
            duckDepth: audio.music?.duckDepth,
            fadeInMs: audio.music?.fadeInMs,
            fadeOutMs: audio.music?.fadeOutMs,
            startMs: outMs,
            endMs: Math.min(tb.durationMs, outMs + len),
          },
        },
      },
      ...(audio.music ? { message: 'Replaced the music track' } : {}),
    }
  }
  // E5b: the same upload can be placed any number of times; each cue gets its own lane id.
  const generationId = sfxPlacementId(item.refId, audio.sfx.map((s) => s.generationId))
  return {
    edits: {
      ...edits,
      audio: {
        ...audio,
        sfx: [...audio.sfx, { generationId, uploadId: item.refId, atMs: outMs, volume: DEFAULT_SFX_VOLUME }],
      },
    },
  }
}

/**
 * E5b: lane / item id of one placement of an uploaded sound: the upload id for the first, then
 * `<uploadId>~2`, `~3`… (`uploadId` stays the real ClipUpload id for preview + export).
 */
export function sfxPlacementId(uploadId: string, existing: readonly string[]): string {
  const taken = new Set(existing)
  if (!taken.has(uploadId)) return uploadId
  for (let n = 2; n < 10_000; n++) {
    const id = `${uploadId}~${n}`
    if (!taken.has(id)) return id
  }
  return `${uploadId}~${Date.now()}`
}

export type InsertMode = 'insert' | 'append'

/**
 * E5b: insert a video / image / Rooms take into the timeline, LENGTHENING it (ripple), right before
 * MAIN SOURCE ms `atSrcMs` (the playhead), or at the end (`append`). Video uses the whole media (or
 * `maxMs`), stills 3 s. Sound defaults to the clip's own track.
 */
export function insertMediaAt(
  edits: ClipEditsV2,
  item: ProjectMediaItem,
  atSrcMs: number,
  mode: InsertMode,
  newId: () => string,
  maxMs?: number,
): AddResult {
  if (item.mediaType === 'audio' || item.isMain) return { edits: null, message: 'Pick a video or image to insert' }
  const len =
    item.mediaType === 'image'
      ? INSERT_IMAGE_DEFAULT_MS
      : Math.min(item.durationMs && item.durationMs > 0 ? item.durationMs : 5000, maxMs ?? INSERT_MAX_MS)
  if (len < INSERT_MIN_MS) return { edits: null, message: 'This clip is too short to insert' }
  // An insert plays its own media from the start, so a synced angle's offset doesn't apply.
  const { syncMs: _sync, ...src } = sourceFromItem(item)
  const { sources, id } = upsertSource(edits.sources, src)
  const ins: ClipInsert = {
    id: newId(),
    sourceId: id,
    atSrcMs: mode === 'append' ? edits.trim.out : Math.round(Math.max(edits.trim.in, Math.min(edits.trim.out, atSrcMs))),
    ...(mode === 'append' ? { append: true as const } : {}),
    inMs: 0,
    durMs: Math.round(len),
    ...(item.mediaType === 'image' ? { audio: 'mute' as const } : {}),
  }
  const inserts = normalizeInserts(addInsert(edits.inserts, ins), sources)
  if (!inserts?.some((i) => i.id === ins.id)) return { edits: null, message: 'Could not insert this media' }
  return {
    edits: { ...edits, sources, inserts },
    message: `${mode === 'append' ? 'Appended' : 'Inserted'} ${(ins.durMs / 1000).toFixed(1)} s, everything after it moved right`,
  }
}

/** Use `item` for the selected Video item (source range) — "Replace with…" / multicam angle per segment. */
export function replaceVideoRange(
  edits: ClipEditsV2,
  item: ProjectMediaItem,
  srcInMs: number,
  srcOutMs: number,
  newId: () => string,
): AddResult {
  if (item.mediaType === 'audio' || item.isMain) return { edits: null, message: 'Pick a video or image' }
  if (srcOutMs - srcInMs < SOURCE_SEG_MIN_MS) return { edits: null, message: 'Segment too short' }
  const { sources, id } = upsertSource(edits.sources, sourceFromItem(item))
  const synced = item.syncMs != null && item.mediaType === 'video'
  const seg = {
    id: newId(),
    sourceId: id,
    startMs: Math.round(srcInMs),
    endMs: Math.round(srcOutMs),
    ...(synced || item.mediaType === 'image' ? {} : { inMs: 0 }),
  }
  return { edits: { ...edits, sources, sourceSegments: setSourceSegment(edits.sourceSegments, seg, sources) } }
}
