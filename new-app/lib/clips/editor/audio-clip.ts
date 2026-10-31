/**
 * G2 manual audio: per-clip fades / ducking / loop, "Fit to length", second music clip.
 * Pure helpers shared by the timeline (fade handles, inspector), the preview mix (use-audio-mix)
 * and the tests. The worker mirrors the math in `audio_render.py` (`clip_fade`, `music_chain`).
 */
import {
  AUDIO_FADE_MAX_MS,
  DEFAULT_DUCK_DEPTH,
  DEFAULT_MUSIC_FADE_IN_MS,
  DEFAULT_MUSIC_FADE_OUT_MS,
  DEFAULT_MUSIC_VOLUME,
  type ClipAudioMusic,
  type ClipAudioSfx,
} from '@/lib/clips/audio'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { musicWindow } from '@/lib/clips/editor/clip-timeline'
import { addTrack, effectiveTracks, isDefaultTrackId, setItemsTrack, trackIdOf } from '@/lib/clips/editor/tracks'

/** "Fit to length" end fade. */
export const FIT_FADE_OUT_MS = 2000
/** Release after a word before a ducked clip comes back up (sidechaincompress release=300 ms). */
export const DUCK_RELEASE_MS = 300

export type FadeSpec = { lenMs: number; fadeInMs: number; fadeOutMs: number }

/**
 * Linear fade gain (ffmpeg `afade` default curve `tri`) at `localMs` of a clip that plays `lenMs`.
 * `clampHalf` (clips, windowed music) limits each fade to half the length, like the export.
 */
export function fadeGain(localMs: number, f: FadeSpec, clampHalf = true): number {
  const len = Math.max(0, f.lenMs)
  const fi = Math.max(0, clampHalf ? Math.min(f.fadeInMs, len / 2) : f.fadeInMs)
  const fo = Math.max(0, clampHalf ? Math.min(f.fadeOutMs, len / 2) : f.fadeOutMs)
  let g = 1
  if (fi > 0 && localMs < fi) g = Math.min(g, Math.max(0, localMs / fi))
  const outSt = Math.max(0, len - fo)
  if (fo > 0 && localMs >= outSt) g = Math.min(g, Math.max(0, (len - localMs) / fo))
  return Math.max(0, Math.min(1, g))
}

/**
 * Music bed fade at OUTPUT ms — the worker's `music_chain`: the legacy whole-clip bed (window = the
 * whole clip from media 0) fades over [0, FI] and [L-FO, L] unclamped; a moved / trimmed window
 * fades on its own length with each fade at most half of it.
 */
export function musicFadeAt(music: ClipAudioMusic, outMs: number, durationMs: number): number {
  const w = musicWindow(music, durationMs)
  if (!w) return 0
  const fi = music.fadeInMs ?? DEFAULT_MUSIC_FADE_IN_MS
  const fo = music.fadeOutMs ?? DEFAULT_MUSIC_FADE_OUT_MS
  const legacy = w.startMs <= 0 && w.inMs <= 0 && w.endMs >= durationMs
  if (legacy) return fadeGain(outMs, { lenMs: durationMs, fadeInMs: fi, fadeOutMs: fo }, false)
  if (outMs < w.startMs || outMs >= w.endMs) return 0
  return fadeGain(outMs - w.startMs, { lenMs: w.endMs - w.startMs, fadeInMs: fi, fadeOutMs: fo }, true)
}

/** How long an audio clip plays (ms): `durMs` capped by its media after the in-point. */
export function clipPlayLenMs(cue: Pick<ClipAudioSfx, 'inMs' | 'durMs'>, mediaMs: number | null | undefined): number | null {
  const full = mediaMs != null && mediaMs > 0 ? mediaMs - (cue.inMs ?? 0) : null
  if (cue.durMs != null) return Math.max(0, full != null ? Math.min(cue.durMs, full) : cue.durMs)
  return full != null ? Math.max(0, full) : null
}

/** Ducking factor at OUTPUT ms: 1 - depth while a caption word is spoken (+ release), else 1. */
export function duckFactorAt(outMs: number, words: readonly { s_ms: number; e_ms: number }[], depth: number): number {
  const d = Math.max(0, Math.min(1, depth))
  if (d <= 0) return 1
  for (const w of words) {
    if (outMs >= w.s_ms && outMs < w.e_ms + DUCK_RELEASE_MS) return 1 - d
  }
  return 1
}

/** Preview gain of an audio clip at its local ms (volume × envelope × fades × ducking). */
export function clipGainAt(input: {
  cue: Pick<ClipAudioSfx, 'atMs' | 'volume' | 'fadeInMs' | 'fadeOutMs' | 'duckDepth'>
  localMs: number
  lenMs: number
  /** Envelope value in % (100 = unity), when the clip has volume keyframes. */
  envPct?: number
  words?: readonly { s_ms: number; e_ms: number }[]
}): number {
  const { cue, localMs, lenMs } = input
  const vol = cue.volume ?? 0.8
  const env = input.envPct != null ? input.envPct / 100 : 1
  const fade = fadeGain(localMs, { lenMs, fadeInMs: cue.fadeInMs ?? 0, fadeOutMs: cue.fadeOutMs ?? 0 })
  const duck = cue.duckDepth != null && input.words ? duckFactorAt(cue.atMs + localMs, input.words, cue.duckDepth) : 1
  return vol * env * fade * duck
}

/** True when a clip needs a sampled gain curve in preview (anything beyond a flat volume). */
export function clipHasGainCurve(cue: Pick<ClipAudioSfx, 'fadeInMs' | 'fadeOutMs' | 'duckDepth'>): boolean {
  return Boolean(cue.fadeInMs || cue.fadeOutMs || cue.duckDepth != null)
}

export type AudioClipPatch = {
  volume?: number
  fadeInMs?: number
  fadeOutMs?: number
  /** null = stop ducking this clip (SFX); music always ducks (depth 0 = off). */
  duckDepth?: number | null
  loop?: boolean
}

const fadeVal = (v: number) => Math.max(0, Math.min(AUDIO_FADE_MAX_MS, Math.round(v)))

/** Patch the music bed (`lane: 'music'`) or one audio clip (`lane: 'sfx'`, by generationId). */
export function patchAudioClip(edits: ClipEditsV2, lane: 'music' | 'sfx', id: string, patch: AudioClipPatch): ClipEditsV2 | null {
  const audio = edits.audio
  if (!audio) return null
  if (lane === 'music') {
    const m = audio.music
    if (!m || m.generationId !== id) return null
    const next: ClipAudioMusic = { ...m }
    if (patch.volume != null) next.volume = Math.max(0, Math.min(1, patch.volume))
    if (patch.fadeInMs != null) next.fadeInMs = fadeVal(patch.fadeInMs)
    if (patch.fadeOutMs != null) next.fadeOutMs = fadeVal(patch.fadeOutMs)
    if (patch.duckDepth !== undefined) next.duckDepth = Math.max(0, Math.min(1, patch.duckDepth ?? 0))
    if (patch.loop !== undefined) {
      if (patch.loop) next.loop = true
      else delete next.loop
    }
    return { ...edits, audio: { ...audio, music: next } }
  }
  const i = audio.sfx.findIndex((s) => s.generationId === id)
  if (i < 0) return null
  const s: ClipAudioSfx = { ...audio.sfx[i]! }
  if (patch.volume != null) s.volume = Math.max(0, Math.min(1, patch.volume))
  for (const k of ['fadeInMs', 'fadeOutMs'] as const) {
    if (patch[k] == null) continue
    const v = fadeVal(patch[k]!)
    if (v > 0) s[k] = v
    else delete s[k]
  }
  if (patch.duckDepth !== undefined) {
    if (patch.duckDepth == null) delete s.duckDepth
    else s.duckDepth = Math.max(0, Math.min(1, patch.duckDepth))
  }
  const sfx = audio.sfx.slice()
  sfx[i] = s
  return { ...edits, audio: { ...audio, sfx } }
}

/**
 * Fade length from a fade-handle drag: the in-handle sits at `fadeInMs` from the clip start,
 * the out-handle at `fadeOutMs` from its end; the two never cross.
 */
export function fadeFromDrag(edge: 'in' | 'out', lenMs: number, startFadeMs: number, otherFadeMs: number, dxMs: number): number {
  const raw = edge === 'in' ? startFadeMs + dxMs : startFadeMs - dxMs
  const room = Math.max(0, lenMs - otherFadeMs)
  return fadeVal(Math.max(0, Math.min(raw, room, AUDIO_FADE_MAX_MS)))
}

/**
 * G2 "Fit to length": the music bed covers the whole video (start 0 → end, media from its start),
 * loops when the song is shorter than the video, and fades out at the end.
 * `mediaMs` unknown → loop on (a loop past a longer song's end never plays).
 */
export function fitMusicToLength(edits: ClipEditsV2, durationMs: number, mediaMs: number | null): ClipEditsV2 | null {
  const m = edits.audio?.music
  if (!m || durationMs <= 0) return null
  const loop = mediaMs == null || mediaMs <= 0 ? true : mediaMs < durationMs
  const fadeOutMs = Math.min(FIT_FADE_OUT_MS, Math.floor(durationMs / 2))
  const next: ClipAudioMusic = { ...m, startMs: 0, inMs: 0, fadeOutMs }
  delete next.endMs
  if (loop) next.loop = true
  else delete next.loop
  return { ...edits, audio: { ...edits.audio!, music: next } }
}

/** Where a looped / plain music bed's media is at OUTPUT ms (null outside its window). */
export function musicMediaMsAt(music: ClipAudioMusic, outMs: number, durationMs: number, mediaMs: number | null): number | null {
  const w = musicWindow(music, durationMs)
  if (!w || outMs < w.startMs || outMs >= w.endMs) return null
  const p = outMs - w.startMs + w.inMs
  if (music.loop && mediaMs != null && mediaMs > 0) return p % mediaMs
  return p
}

/**
 * G2: a second song dropped on the Music lane no longer replaces the first — it becomes a
 * music-style audio clip (ducked, 0.5 s / 1 s fades, music volume) on an extra audio track
 * ("Music 2", reused when free at that time, created otherwise).
 */
export function addMusicClip(
  edits: ClipEditsV2,
  input: { generationId: string; uploadId: string; atMs: number; lenMs: number; durationMs: number },
): { edits: ClipEditsV2; trackName: string } | null {
  const audio = edits.audio ?? { music: null, sfx: [] }
  const playMs = Math.max(0, Math.min(input.lenMs, input.durationMs - input.atMs))
  if (playMs < 100) return null
  const cue: ClipAudioSfx = {
    generationId: input.generationId,
    uploadId: input.uploadId,
    atMs: Math.round(input.atMs),
    volume: DEFAULT_MUSIC_VOLUME,
    durMs: Math.round(playMs),
    fadeInMs: DEFAULT_MUSIC_FADE_IN_MS,
    fadeOutMs: DEFAULT_MUSIC_FADE_OUT_MS,
    duckDepth: audio.music?.duckDepth ?? DEFAULT_DUCK_DEPTH,
  }
  let next: ClipEditsV2 = { ...edits, audio: { ...audio, sfx: [...audio.sfx, cue] } }
  const end = cue.atMs + playMs
  const ts = effectiveTracks(next)
  const busy = (trackId: string) =>
    audio.sfx.some((s) => {
      if (trackIdOf(next, 'audio', s.generationId, ts) !== trackId) return false
      const sEnd = s.atMs + (s.durMs ?? 1000)
      return s.atMs < end && sEnd > cue.atMs
    })
  const free = ts.find((t) => t.kind === 'audio' && !isDefaultTrackId(t.id) && /^music\b/i.test(t.name ?? '') && !busy(t.id))
  let trackId = free?.id
  let trackName = free?.name ?? ''
  if (!trackId) {
    const n = ts.filter((t) => t.kind === 'audio' && /^music\b/i.test(t.name ?? '')).length + 2
    const added = addTrack(next, 'audio', { name: `Music ${n}` })
    if (!added) return { edits: next, trackName: 'SFX' }
    next = added.edits
    trackId = added.trackId
    trackName = `Music ${n}`
  }
  next = setItemsTrack(next, 'audio', [cue.generationId], trackId) ?? next
  return { edits: next, trackName }
}
