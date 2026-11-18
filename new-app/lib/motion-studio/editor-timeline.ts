import { defaultEdits, type ClipEditsV2, type ClipMotionStudioExt } from '@/lib/clips/edits'
import type { ClipAudioMusic } from '@/lib/clips/audio'
import type { Marker } from '@/lib/clips/editor/markers'

/**
 * FE-6 / BE-9: map an assembled Motion Studio program onto the EXISTING Compact Editor timeline (ClipEditsV2).
 *
 * - Canvas (main source) = picture + dialog (narration, footage sound, SFX) when the worker wrote editor stems,
 *   else the full master (older assemblies).
 * - Scenes and footage inserts = Video-lane split points (`videoSplits`) at every segment boundary, so each scene /
 *   insert is its own selectable, trimmable, deletable item. Narration lives in the canvas, so deleting a scene
 *   removes its words too and captions stay in sync.
 * - Music = the Compact Music lane (`audio.music`, a project-media upload): volume, fades, duck, swap, remove.
 * - Chapters = chapter markers. `edits.motionStudio` keeps the labelled lanes for the Motion Studio strip.
 *
 * Re-sync (new timelineVersion after a scene re-render) keeps the user's own edits; Motion Studio-owned pieces
 * (splits, chapter markers, our music item) are refreshed. A music item the user swapped or removed stays as they left it.
 */

export const MS_MUSIC_ID_PREFIX = 'msmu'
const MS_MARKER_PREFIX = 'ms_ch_'

export type MsEditorStems = { canvas?: 'dialog'; musicKey?: string; gainDb?: number; durationMs?: number }

type Segment = { startMs?: number; endMs?: number }

export function sceneSplitsMs(ext: ClipMotionStudioExt | undefined, durationMs: number): number[] {
  const segs = (ext?.segments ?? []) as Segment[]
  const out = new Set<number>()
  for (const s of segs) {
    const t = Math.round(Number(s.startMs))
    if (Number.isFinite(t) && t > 0 && t < durationMs) out.add(t)
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * Agent films have a fully assembled master MP4 as the editor canvas. Each
 * manifest scene is a cut on THAT canvas, never a partial secondary source
 * replacement. Preserve customer-authored source overrides across reimports.
 */
export function agentCanvasVideoLayout(base: ClipEditsV2, ext: ClipMotionStudioExt, durationMs: number):
  Pick<ClipEditsV2, 'videoSplits' | 'sourceSegments'> {
  return {
    videoSplits: sceneSplitsMs(ext, durationMs),
    sourceSegments: (base.sourceSegments ?? []).filter(item => !item.id.startsWith('ms_')),
  }
}

export type BuildEditorEditsInput = {
  base: ClipEditsV2 | null
  durationMs: number
  patch: { markers?: Marker[]; motionStudio?: ClipMotionStudioExt }
  /** Upload id of this version's music stem (already registered as project media), or null. */
  musicUploadId: string | null
  /** Music upload id we placed last time (clip aiMeta), to tell "user removed it" from "never had it". */
  lastPlacedMusicUploadId: string | null
}

export function buildMotionStudioEditorEdits(i: BuildEditorEditsInput): ClipEditsV2 {
  const d = i.durationMs
  const base = i.base ?? defaultEdits({ clipStartMs: 0, clipEndMs: d, trimMinMs: 0, trimMaxMs: d })
  const userMarkers = (base.markers ?? []).filter(m => !String(m.id).startsWith(MS_MARKER_PREFIX))
  const markers = [...userMarkers, ...(i.patch.markers ?? [])].sort((a, b) => a.ms - b.ms)

  const prev = base.audio?.music ?? null
  const prevIsOurs = Boolean(prev?.uploadId && prev.uploadId.startsWith(MS_MUSIC_ID_PREFIX))
  const userRemoved = !prev && Boolean(i.lastPlacedMusicUploadId) && Boolean(i.base)
  let music: ClipAudioMusic | null = null
  if (prev && !prevIsOurs) {
    music = prev                                        // the user's own music: never overwritten
  } else if (!userRemoved && i.musicUploadId) {
    music = {
      generationId: i.musicUploadId,
      uploadId: i.musicUploadId,
      volume: prev?.volume ?? 1,                        // the stem is already at the master's mix level
      duckDepth: prev?.duckDepth ?? 0.55,
      fadeInMs: prev?.fadeInMs ?? 0,                    // the score has its own intro / resolve
      fadeOutMs: prev?.fadeOutMs ?? 0,
      startMs: 0,
      endMs: d,
      inMs: 0,
      ...(prev?.pan != null ? { pan: prev.pan } : {}),
    }
  }

  return {
    ...base,
    trim: { in: 0, out: d },
    aspectRatio: '16:9',
    layout: { ...(base.layout ?? { shotOverrides: [] }), mode: 'full_frame', shotOverrides: base.layout?.shotOverrides ?? [] },
    markers,
    videoSplits: sceneSplitsMs(i.patch.motionStudio, d),
    audio: { music, sfx: base.audio?.sfx ?? [], ...(base.audio?.studioSound !== undefined ? { studioSound: base.audio.studioSound } : {}) },
    motionStudio: i.patch.motionStudio,
  }
}
