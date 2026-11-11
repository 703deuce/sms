export type ClipAudioMusic = {
  /** AI generation id, or (E5) the ClipUpload id when `uploadId` is set (lane / item id stays unique). */
  generationId: string
  /** E5: the user's own audio from the project media library. */
  uploadId?: string
  volume?: number
  duckDepth?: number
  fadeInMs?: number
  fadeOutMs?: number
  /** E2 timeline window in OUTPUT ms (default 0 .. clip end). */
  startMs?: number
  endMs?: number
  /** Music media in-point at startMs (left-trim keeps content anchored). */
  inMs?: number
  /** G2: loop the media to fill the window ("Fit to length"). Export: `-stream_loop -1`. */
  loop?: boolean
  pan?: number
}

export type ClipAudioSfx = {
  generationId: string
  /** E5: user upload (generationId === uploadId). */
  uploadId?: string
  atMs: number
  volume?: number
  /** G1b3: media in-point / play length (detached audio of a B-roll clip). */
  inMs?: number
  durMs?: number
  /** G1c split stereo: play only this channel of the media, as mono. */
  channel?: 'L' | 'R'
  /** G2: fades on the clip's own play length (linear, like ffmpeg `afade`). */
  fadeInMs?: number
  fadeOutMs?: number
  /** G2: duck this clip under the voice (music-style); absent = not ducked. */
  duckDepth?: number
  /**
   * G2fix: what the clip is. 'music' = a song (full music controls: Loop, Fit to length, BPM),
   * 'audio' = clip / mic audio (detached, split L/R). Absent (older saves) = derived: a clip on a
   * "Music…" audio track is music (lib/clips/editor/audio-kind.ts), else SFX.
   */
  kind?: 'music' | 'audio'
  /** Ad Studio narration is displayed in the Voice lane while retaining the existing audio-mix contract. */
  voiceover?: boolean
  /** G2fix: loop the media to fill `durMs` (music clips; export `-stream_loop -1`). Needs durMs. */
  loop?: boolean
  /** AU-12: balance pan −100 (L) … 100 (R); absent = centre. */
  pan?: number
}

export type ClipStudioSound = {
  enabled: boolean
  generationId: string
  mix?: number
}

export type ClipEditsAudio = {
  music: ClipAudioMusic | null
  sfx: ClipAudioSfx[]
  studioSound?: ClipStudioSound | null
}

export const DEFAULT_MUSIC_VOLUME = 0.5
export const DEFAULT_DUCK_DEPTH = 0.55
export const DEFAULT_MUSIC_FADE_IN_MS = 500
export const DEFAULT_MUSIC_FADE_OUT_MS = 1000
export const DEFAULT_SFX_VOLUME = 0.8
/** G2: longest fade handle on one audio clip. */
export const AUDIO_FADE_MAX_MS = 10_000
/** Default Studio Sound mix for clip editor (low; user can raise). */
export const DEFAULT_STUDIO_SOUND_MIX = 0.35

const pan4 = (v: number) => Math.round(v * 10000) / 10000

/** AU-12 linear balance law (centre = unity). */
export function panGains(pan?: number): [number, number] {
  const p = Math.max(-1, Math.min(1, (pan ?? 0) / 100))
  if (p <= 0) return [1, pan4(1 + p)]
  return [pan4(1 - p), 1]
}

function normalizePan(v: unknown): number | undefined {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n) || n === 0) return undefined
  return Math.max(-100, Math.min(100, n))
}

export const SFX_PRESETS: { id: string; label: string; prompt: string }[] = [
  { id: 'whoosh', label: 'Whoosh', prompt: 'Quick cinematic whoosh transition sound' },
  { id: 'pop', label: 'Pop', prompt: 'Short soft UI pop sound' },
  { id: 'ding', label: 'Ding', prompt: 'Bright notification ding' },
  { id: 'bass_drop', label: 'Bass drop', prompt: 'Short deep bass drop impact' },
  { id: 'record_scratch', label: 'Record scratch', prompt: 'Classic vinyl record scratch stop' },
  { id: 'camera_shutter', label: 'Shutter', prompt: 'Camera shutter click' },
  { id: 'swoosh_up', label: 'Swoosh up', prompt: 'Rising airy swoosh up' },
  { id: 'glitch', label: 'Glitch', prompt: 'Short digital glitch stutter' },
  { id: 'applause_short', label: 'Applause', prompt: 'Short crowd applause burst' },
  { id: 'boom', label: 'Boom', prompt: 'Deep cinematic boom hit' },
]

export function presetPrompt(presetId: string): string | null {
  return SFX_PRESETS.find((p) => p.id === presetId)?.prompt ?? null
}

/** ElevenLabs music: $0.15/min */
export function musicCostUsd(lengthMs: number): number {
  const minutes = Math.max(3, lengthMs) / 60_000
  return (minutes * 0.15)
}

/** ElevenLabs SFX: $0.12/min billed by duration */
export function sfxCostUsd(durationSec: number): number {
  const minutes = Math.max(0.5, durationSec) / 60
  return minutes * 0.12
}

export function normalizeAudioEdits(raw: unknown): ClipEditsAudio {
  const base: ClipEditsAudio = { music: null, sfx: [] }
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const music = o.music
  let musicOut: ClipAudioMusic | null = null
  if (music && typeof music === 'object' && music !== null) {
    const m = music as Record<string, unknown>
    const uploadId = uploadRef(m.uploadId)
    const generationId = uploadId ?? String(m.generationId || '')
    if (generationId) {
      musicOut = {
        generationId,
        ...(uploadId ? { uploadId } : {}),
        volume: clamp01(m.volume, DEFAULT_MUSIC_VOLUME),
        duckDepth: clamp01(m.duckDepth, DEFAULT_DUCK_DEPTH),
        fadeInMs: num(m.fadeInMs, DEFAULT_MUSIC_FADE_IN_MS),
        fadeOutMs: num(m.fadeOutMs, DEFAULT_MUSIC_FADE_OUT_MS),
        ...optionalMs('startMs', m.startMs),
        ...optionalMs('endMs', m.endMs),
        ...optionalMs('inMs', m.inMs),
        ...(m.loop === true ? { loop: true } : {}),
        ...(normalizePan(m.pan) != null ? { pan: normalizePan(m.pan) } : {}),
      }
    }
  }
  let studioOut: ClipStudioSound | null = null
  const studio = o.studioSound
  if (studio && typeof studio === 'object' && studio !== null) {
    const s = studio as Record<string, unknown>
    const generationId = String(s.generationId || s.assetId || '')
    const enabled = Boolean(s.enabled)
    if (enabled || generationId) {
      studioOut = {
        enabled,
        generationId,
        mix: clamp01(s.mix, DEFAULT_STUDIO_SOUND_MIX),
      }
    }
  }
  const sfxRaw = Array.isArray(o.sfx) ? o.sfx : []
  const sfx: ClipAudioSfx[] = sfxRaw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const s = row as Record<string, unknown>
      const uploadId = uploadRef(s.uploadId)
      const rawId = String(s.generationId || '')
      // E5b: an uploaded sound placed more than once keeps a per-placement id `<uploadId>~N`.
      const generationId = uploadId ? (rawId.startsWith(`${uploadId}~`) && rawId.length <= uploadId.length + 8 ? rawId : uploadId) : rawId
      if (!generationId) return null
      return {
        generationId,
        ...(uploadId ? { uploadId } : {}),
        atMs: Math.max(0, Math.round(num(s.atMs, 0))),
        volume: clamp01(s.volume, DEFAULT_SFX_VOLUME),
        ...(num(s.inMs, 0) > 0 ? { inMs: Math.round(num(s.inMs, 0)) } : {}),
        ...(num(s.durMs, 0) >= 100 ? { durMs: Math.round(num(s.durMs, 0)) } : {}),
        ...(s.channel === 'L' || s.channel === 'R' ? { channel: s.channel } : {}),
        ...fadeMs('fadeInMs', s.fadeInMs),
        ...fadeMs('fadeOutMs', s.fadeOutMs),
        ...(s.duckDepth != null && Number.isFinite(Number(s.duckDepth)) ? { duckDepth: clamp01(s.duckDepth, DEFAULT_DUCK_DEPTH) } : {}),
        ...(s.kind === 'music' || s.kind === 'audio' ? { kind: s.kind } : {}),
        ...(s.voiceover === true ? { voiceover: true } : {}),
        ...(s.loop === true && num(s.durMs, 0) >= 100 ? { loop: true } : {}),
        ...(normalizePan(s.pan) != null ? { pan: normalizePan(s.pan) } : {}),
      }
    })
    .filter(Boolean) as ClipAudioSfx[]
  // Lane ids must stay unique (older saves could hold the same upload twice under one id).
  const usedIds = new Set<string>()
  for (const cue of sfx) {
    if (!usedIds.has(cue.generationId)) {
      usedIds.add(cue.generationId)
      continue
    }
    if (!cue.uploadId) continue
    let n = 2
    while (usedIds.has(`${cue.uploadId}~${n}`)) n++
    cue.generationId = `${cue.uploadId}~${n}`
    usedIds.add(cue.generationId)
  }
  return { music: musicOut, sfx, studioSound: studioOut }
}

function optionalMs<K extends 'startMs' | 'endMs' | 'inMs'>(key: K, v: unknown): Partial<Record<K, number>> {
  if (v == null) return {}
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return {}
  return { [key]: Math.round(n) } as Partial<Record<K, number>>
}

/** G2: a clip fade (whole ms, 1..AUDIO_FADE_MAX_MS); 0 / junk = no fade (key omitted). */
function fadeMs<K extends 'fadeInMs' | 'fadeOutMs'>(key: K, v: unknown): Partial<Record<K, number>> {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n) || n <= 0) return {}
  return { [key]: Math.min(AUDIO_FADE_MAX_MS, n) } as Partial<Record<K, number>>
}

function clamp01(v: unknown, fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(1, n))
}

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export const ARTIST_NAME_RE =
  /\b(?:feat\.?|ft\.?|by)\s+[A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+){0,3}\b/gi

export function stripArtistSongNames(text: string): string {
  return text
    .replace(ARTIST_NAME_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** E5: a ClipUpload id used as a music / SFX source (strict charset; never a URL). */
function uploadRef(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^[A-Za-z0-9_-]{1,120}$/.test(s) ? s : undefined
}

/** E5: key for preview URL lookups — uploads resolve from the media library, not /generations. */
export function isUploadAudio(a: { uploadId?: string } | null | undefined): boolean {
  return Boolean(a?.uploadId)
}
