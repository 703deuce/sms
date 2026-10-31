/**
 * G2fix: what an audio clip on the SFX lane / an audio track IS — a song ('music'), clip / mic
 * audio ('audio': detached B-roll sound, split L/R), or a sound effect ('sfx').
 *
 * New clips store `kind` explicitly. Older saves (no `kind`) are classified on load, without a
 * migration: a clip on a "Music…" audio track is music (G2 put second songs there as plain
 * cues), a split-channel clip or a long trimmed clip is audio, anything else stays an SFX.
 * The export never needs the kind — fades / duck / loop are explicit keys on the cue.
 */
import type { ClipAudioSfx } from '@/lib/clips/audio'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { effectiveTracks, isDefaultTrackId, trackIdOf, type Track } from '@/lib/clips/editor/tracks'

export type AudioClipKind = 'music' | 'audio' | 'sfx'

/** Older clips longer than this with an explicit length (detached audio) read as "Audio". */
export const LEGACY_AUDIO_MIN_MS = 8000

/** "Music", "Music 2", "music bed"… — the names G2 gives its extra music tracks. */
export function isMusicTrackName(name: string | null | undefined): boolean {
  return /^\s*music\b/i.test(name ?? '')
}

/** True when `trackId` is an extra audio track named like a music track. */
export function isMusicTrack(edits: Pick<ClipEditsV2, 'tracks'>, trackId: string | null | undefined, tracks?: Track[]): boolean {
  if (!trackId || isDefaultTrackId(trackId)) return false
  const t = (tracks ?? effectiveTracks(edits)).find((x) => x.id === trackId)
  return Boolean(t && t.kind === 'audio' && isMusicTrackName(t.name))
}

export function audioClipKind(
  edits: Pick<ClipEditsV2, 'tracks'>,
  cue: Pick<ClipAudioSfx, 'generationId' | 'kind' | 'channel' | 'durMs' | 'uploadId'>,
  tracks?: Track[],
): AudioClipKind {
  if (cue.kind === 'music' || cue.kind === 'audio') return cue.kind
  // Legacy (G2): second songs were plain cues on "Music N" tracks — treat them as music.
  if (cue.uploadId && isMusicTrack(edits, trackIdOf(edits, 'audio', cue.generationId, tracks), tracks)) return 'music'
  if (cue.channel) return 'audio'
  if (cue.durMs != null && cue.durMs >= LEGACY_AUDIO_MIN_MS) return 'audio'
  return 'sfx'
}

export const AUDIO_KIND_LABEL: Record<AudioClipKind, string> = { music: 'Music', audio: 'Audio', sfx: 'SFX' }

/** Kind of the cue with lane id `id` (null when there is none). */
export function audioClipKindOf(edits: ClipEditsV2, id: string, tracks?: Track[]): AudioClipKind | null {
  const cue = edits.audio?.sfx.find((s) => s.generationId === id)
  return cue ? audioClipKind(edits, cue, tracks) : null
}
