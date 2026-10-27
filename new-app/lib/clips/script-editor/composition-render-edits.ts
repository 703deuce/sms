import type { BrollItem } from '@/lib/clips/broll'
import { normalizeBrollItems } from '@/lib/clips/broll'
import type { ClipEditsV2, CutRange } from '@/lib/clips/edits'
import { normalizeAudioEdits } from '@/lib/clips/audio'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

/** Map script document + EDL cut/trim into clipper `ClipEditsV2` for worker render stack. */
export function clipEditsFromScriptDocument(
  document: ScriptDocumentV1,
  opts: {
    trimInMs: number
    trimOutMs: number
    cutRanges: CutRange[]
    projectAspect?: string
  },
): ClipEditsV2 {
  const settings = document.settings ?? {}
  const captions = settings.captions ?? {}
  const clipDur = Math.max(1, opts.trimOutMs - opts.trimInMs)
  const broll = normalizeBrollItems(document.broll ?? [], clipDur)

  const layoutMode =
    settings.reframeMode === 'center_crop'
      ? 'center_crop'
      : settings.reframeMode === 'manual'
        ? 'center_crop'
        : 'speaker_follow'

  const edits: ClipEditsV2 = {
    v: 2,
    trim: { in: opts.trimInMs, out: opts.trimOutMs },
    cutRanges: opts.cutRanges,
    wordFixes: {},
    captions: {
      enabled: settings.captionsEnabled !== false && captions.enabled !== false,
      presetId: captions.presetId || 'bold_pop',
      animation: captions.animation,
      size: captions.size,
      position: captions.position,
      case: captions.case,
      wordsPerLine: captions.wordsPerLine,
      colors: captions.colors,
      keywordHighlight: captions.keywordHighlight,
      emphasis: captions.emphasis,
    },
    layout: { mode: layoutMode, shotOverrides: [] },
    broll: broll.length ? broll : undefined,
  }

  const audioFromDoc = document.audio
  const firstMusic = document.musicTracks?.[0]
  const studio = document.audioFx?.studioSound
  if (audioFromDoc) {
    edits.audio = normalizeAudioEdits(audioFromDoc)
  } else if (firstMusic?.assetId) {
    edits.audio = normalizeAudioEdits({
      music: {
        generationId: firstMusic.assetId,
        volume: 0.25,
        duckDepth: firstMusic.duckUnderSpeech ? 0.7 : 0.3,
        fadeInMs: 500,
        fadeOutMs: 1000,
      },
    })
  }
  if (studio?.enabled && studio.assetId) {
    edits.audio = {
      ...(edits.audio ?? { music: null, sfx: [] }),
      studioSound: { enabled: true, generationId: studio.assetId, mix: studio.mix ?? 0.8 },
    }
  }
  const lufs = document.audioFx?.loudnessLufs
  if (lufs != null) {
    edits.loudnessLufs = lufs
  }

  return edits
}

export function mergeBrollItems(existing: BrollItem[] | undefined, add: BrollItem[]): BrollItem[] {
  const map = new Map((existing ?? []).map((b) => [b.id, b]))
  for (const item of add) map.set(item.id, item)
  return [...map.values()].sort((a, b) => a.startMs - b.startMs)
}
