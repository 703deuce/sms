/**
 * Q6.1: Studio Sound / denoise per lane (voice, music, voiceover) — reuses existing
 * voice Studio Sound job + G1c track FX NR (Q3.4 nrMix) on music / voiceover buses.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ClipStudioSound } from '@/lib/clips/audio'
import { DEFAULT_STUDIO_SOUND_MIX } from '@/lib/clips/audio'
import { FX_LIMITS, type TrackFx } from '@/lib/clips/editor/track-fx'

export type StudioSoundLane = 'voice' | 'music' | 'voiceover'

export const STUDIO_SOUND_LANE_LABEL: Record<StudioSoundLane, string> = {
  voice: 'Voice (main)',
  music: 'Music',
  voiceover: 'Voiceover',
}

export type StudioSoundLaneState = {
  enabled: boolean
  mix: number
  /** Voice lane only — generation id when ready. */
  generationId?: string
}

function trackFxList(edits: ClipEditsV2): TrackFx[] {
  return edits.trackFx ?? []
}

function fxFor(edits: ClipEditsV2, key: string): TrackFx | undefined {
  return trackFxList(edits).find((f) => f.track === key)
}

export function readStudioSoundLanes(edits: ClipEditsV2): Record<StudioSoundLane, StudioSoundLaneState> {
  const voice = edits.audio?.studioSound
  const musicFx = fxFor(edits, 'music')
  const voFx = fxFor(edits, 'voiceover')
  return {
    voice: {
      enabled: Boolean(voice?.enabled),
      mix: voice?.mix ?? DEFAULT_STUDIO_SOUND_MIX,
      generationId: voice?.generationId,
    },
    music: {
      enabled: musicFx?.nr != null,
      mix: musicFx?.nrMix ?? 1,
    },
    voiceover: {
      enabled: voFx?.nr != null,
      mix: voFx?.nrMix ?? 1,
    },
  }
}

function upsertTrackFx(edits: ClipEditsV2, key: string, patch: Partial<Omit<TrackFx, 'track'>> | null): ClipEditsV2 {
  const list = [...(edits.trackFx ?? [])]
  const i = list.findIndex((f) => f.track === key)
  if (!patch) {
    if (i >= 0) list.splice(i, 1)
  } else if (i >= 0) {
    list[i] = { ...list[i]!, ...patch, track: key }
  } else {
    list.push({ track: key, ...patch })
  }
  return { ...edits, trackFx: list.length ? list : undefined }
}

export function patchStudioSoundLane(
  edits: ClipEditsV2,
  lane: StudioSoundLane,
  patch: Partial<StudioSoundLaneState>,
): ClipEditsV2 {
  if (lane === 'voice') {
    const prev = edits.audio?.studioSound
    const next: ClipStudioSound | null =
      patch.enabled === false
        ? prev
          ? { ...prev, enabled: false }
          : null
        : {
            enabled: true,
            generationId: patch.generationId ?? prev?.generationId ?? '',
            mix: patch.mix ?? prev?.mix ?? DEFAULT_STUDIO_SOUND_MIX,
          }
    return {
      ...edits,
      audio: { ...(edits.audio ?? { music: null, sfx: [] }), studioSound: next },
    }
  }
  const key = lane === 'music' ? 'music' : 'voiceover'
  const enabled = patch.enabled
  const mix = patch.mix
  const cur = fxFor(edits, key)
  if (enabled === false) {
    return upsertTrackFx(edits, key, cur?.nr != null ? { nr: undefined, nrMix: undefined } : null)
  }
  const nr = cur?.nr ?? FX_LIMITS.nr[2]
  const nrMix = mix ?? cur?.nrMix ?? 1
  return upsertTrackFx(edits, key, { nr, nrMix })
}
