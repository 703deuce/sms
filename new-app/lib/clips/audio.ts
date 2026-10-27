export type ClipAudioMusic = {
  generationId: string
  volume?: number
  duckDepth?: number
  fadeInMs?: number
  fadeOutMs?: number
}

export type ClipAudioSfx = {
  generationId: string
  atMs: number
  volume?: number
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

export const DEFAULT_MUSIC_VOLUME = 0.25
export const DEFAULT_DUCK_DEPTH = 0.7
export const DEFAULT_MUSIC_FADE_IN_MS = 500
export const DEFAULT_MUSIC_FADE_OUT_MS = 1000
export const DEFAULT_SFX_VOLUME = 0.8

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
    const generationId = String(m.generationId || '')
    if (generationId) {
      musicOut = {
        generationId,
        volume: clamp01(m.volume, DEFAULT_MUSIC_VOLUME),
        duckDepth: clamp01(m.duckDepth, DEFAULT_DUCK_DEPTH),
        fadeInMs: num(m.fadeInMs, DEFAULT_MUSIC_FADE_IN_MS),
        fadeOutMs: num(m.fadeOutMs, DEFAULT_MUSIC_FADE_OUT_MS),
      }
    }
  }
  let studioOut: ClipStudioSound | null = null
  const studio = o.studioSound
  if (studio && typeof studio === 'object' && studio !== null) {
    const s = studio as Record<string, unknown>
    const generationId = String(s.generationId || s.assetId || '')
    if (generationId) {
      studioOut = {
        enabled: Boolean(s.enabled ?? true),
        generationId,
        mix: clamp01(s.mix, 0.8),
      }
    }
  }
  const sfxRaw = Array.isArray(o.sfx) ? o.sfx : []
  const sfx: ClipAudioSfx[] = sfxRaw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const s = row as Record<string, unknown>
      const generationId = String(s.generationId || '')
      if (!generationId) return null
      return {
        generationId,
        atMs: Math.max(0, Math.round(num(s.atMs, 0))),
        volume: clamp01(s.volume, DEFAULT_SFX_VOLUME),
      }
    })
    .filter(Boolean) as ClipAudioSfx[]
  return { music: musicOut, sfx, studioSound: studioOut }
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
