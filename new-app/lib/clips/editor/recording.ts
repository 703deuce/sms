/**
 * Clip editor in-project recording (AU-25 voiceover, PR-06/09 camera). Pure helpers — no DOM.
 */
import type { ClipAudioSfx } from '@/lib/clips/audio'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { outputToSource, type Timebase } from '@/lib/clips/editor/clip-timeline'
import {
  addMediaToLane,
  insertMediaAt,
  sfxPlacementId,
  type AddResult,
  type ProjectMediaItem,
} from '@/lib/clips/editor/media-add'
import { addTrack, effectiveTracks, isDefaultTrackId, setItemsTrack, trackIdOf } from '@/lib/clips/editor/tracks'

export type RecorderKind = 'voiceover' | 'camera' | 'screen'
export type VideoPlaceMode = 'insert' | 'append' | 'overlay'

const VIDEO_MIMES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const

const AUDIO_MIMES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'] as const

/** Pick the first supported MediaRecorder mime (MP4 preferred for video). */
export function pickRecorderMime(
  kind: 'video' | 'audio',
  isSupported: (mime: string) => boolean = (m) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
): string {
  const list = kind === 'video' ? VIDEO_MIMES : AUDIO_MIMES
  return list.find((m) => isSupported(m)) ?? ''
}

export function mimeExt(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('webm')) return 'webm'
  return 'bin'
}

/** Next free take label among project media names: `Voiceover 1.webm`, `Camera 2.mp4`, … */
export function takeFileName(kind: RecorderKind, existingLabels: readonly string[], ext: string): string {
  const base = kind === 'voiceover' ? 'Voiceover' : kind === 'camera' ? 'Camera' : 'Screen'
  const taken = new Set(existingLabels.map((l) => l.trim().toLowerCase()))
  for (let n = 1; n < 10_000; n++) {
    const name = `${base} ${n}.${ext}`
    if (!taken.has(name.toLowerCase())) return name
  }
  return `${base} ${Date.now()}.${ext}`
}

export function estimateTakeBytes(ms: number, bitrateBps: number): number {
  return Math.round((Math.max(0, ms) / 1000) * (bitrateBps / 8))
}

export function isVoiceoverTrackName(name: string | null | undefined): boolean {
  return /^\s*voiceover\b/i.test(name ?? '')
}

/**
 * AU-25: voiceover cue on a "Voiceover" audio track (created or reused; overlap → "Voiceover 2").
 */
export function addVoiceoverClip(
  edits: ClipEditsV2,
  uploadId: string,
  atMs: number,
  durMs: number,
  newId: () => string,
): ClipEditsV2 {
  void newId
  const audio = edits.audio ?? { music: null, sfx: [] }
  const playMs = Math.max(100, Math.round(durMs))
  const generationId = sfxPlacementId(uploadId, audio.sfx.map((s) => s.generationId))
  const cue: ClipAudioSfx = {
    generationId,
    uploadId,
    atMs: Math.round(atMs),
    durMs: playMs,
    volume: 1,
    kind: 'audio',
  }
  let next: ClipEditsV2 = { ...edits, audio: { ...audio, sfx: [...audio.sfx, cue] } }
  const end = cue.atMs + playMs
  const ts = effectiveTracks(next)
  const busy = (trackId: string) =>
    audio.sfx.some((s) => {
      if (trackIdOf(next, 'audio', s.generationId, ts) !== trackId) return false
      const sEnd = s.atMs + (s.durMs ?? 1000)
      return s.atMs < end && sEnd > cue.atMs
    }) ||
    (next.audio?.sfx ?? []).some((s) => {
      if (s.generationId === cue.generationId) return false
      if (trackIdOf(next, 'audio', s.generationId, ts) !== trackId) return false
      const sEnd = s.atMs + (s.durMs ?? 1000)
      return s.atMs < end && sEnd > cue.atMs
    })

  const voTracks = () => effectiveTracks(next).filter((t) => t.kind === 'audio' && isVoiceoverTrackName(t.name))
  let trackId = voTracks().find((t) => !busy(t.id))?.id
  if (!trackId) {
    const n = voTracks().length + 1
    const name = n <= 1 ? 'Voiceover' : `Voiceover ${n}`
    const added = addTrack(next, 'audio', { name })
    if (!added) return next
    next = added.edits
    trackId = added.trackId
  }
  next = setItemsTrack(next, 'audio', [generationId], trackId) ?? next
  return next
}

/** PR-09: place a recorded video take (insert / append / B-roll overlay). */
export function placeRecordedVideo(
  edits: ClipEditsV2,
  tb: Timebase,
  item: ProjectMediaItem,
  mode: VideoPlaceMode,
  atMs: number,
  newId: () => string,
): AddResult {
  const maxMs = item.durationMs && item.durationMs > 0 ? item.durationMs : undefined
  if (mode === 'overlay') {
    return addMediaToLane(edits, tb, item, 'broll', atMs, newId)
  }
  const atSrcMs =
    mode === 'append' ? edits.trim.out : outputToSource(tb, Math.max(0, Math.min(tb.durationMs, atMs)))
  return insertMediaAt(edits, item, atSrcMs, mode === 'append' ? 'append' : 'insert', newId, maxMs)
}

export const RECORD_MAX_MS = 30 * 60 * 1000
export const RECORD_WARN_MS = 25 * 60 * 1000
export const VIDEO_BITS_PER_SECOND = 8_000_000
export const AUDIO_BITS_PER_SECOND = 256_000
