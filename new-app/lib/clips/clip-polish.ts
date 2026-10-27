import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { autoCaptionEmphasisIndexes } from '@/lib/clips/caption-keyword-emphasis'
import {
  applySilenceTrimToEdits,
  SILENCE_TRIM_NATURAL,
  SILENCE_TRIM_STREAM_GENTLE,
  type SilenceTrimSettings,
} from '@/lib/clips/silence-trim'
import { clampBrandLogoPosition } from '@/lib/clips/overlay-safe-zone'
import type { ClipWord } from '@/lib/clips/edits'
import { DEFAULT_DUCK_DEPTH } from '@/lib/clips/audio'

export type ClipPolishFeature =
  | 'CAPTIONS'
  | 'ZOOM'
  | 'SILENCE'
  | 'COLD_OPEN'
  | 'HOOK'
  | 'SAFE_ZONE'
  | 'AUDIO'
  | 'LENGTH'
  | 'OVERLAYS'

const FEATURE_ENV: Record<ClipPolishFeature, string> = {
  CAPTIONS: 'CLIP_POLISH_CAPTIONS',
  ZOOM: 'CLIP_POLISH_ZOOM',
  SILENCE: 'CLIP_POLISH_SILENCE',
  COLD_OPEN: 'CLIP_POLISH_COLD_OPEN',
  HOOK: 'CLIP_POLISH_HOOK',
  SAFE_ZONE: 'CLIP_POLISH_SAFE_ZONE',
  AUDIO: 'CLIP_POLISH_AUDIO',
  LENGTH: 'CLIP_POLISH_LENGTH',
  OVERLAYS: 'CLIP_POLISH_OVERLAYS',
}

/** Master kill-switch: CLIP_POLISH_DEFAULT=0 disables all polish features. */
export function clipPolishFeatureEnabled(feature: ClipPolishFeature): boolean {
  if (process.env.CLIP_POLISH_DEFAULT === '0') return false
  const key = FEATURE_ENV[feature]
  const v = process.env[key]
  if (v === '0' || v === 'false') return false
  if (v === '1' || v === 'true') return true
  return true
}

export const POLISHED_CAPTION_PRESET_CONFIG = {
  font: 'Montserrat',
  weight: 900,
  outlineW: 8,
  primary: '#FFFFFF',
  active: '#FFD93D',
  activeB: '#39FF14',
  emphasisScale: 1.12,
} as const

export function polishedCaptionPatch(streamClip = false): ClipEditsV2['captions'] {
  return {
    enabled: true,
    presetId: 'bold_pop',
    animation: 'pop',
    wordsPerLine: 3,
    case: streamClip ? 'upper' : 'sentence',
    keywordHighlight: true,
    size: 6.5,
    position: 'bottom',
    marginVPct: 14,
    colors: { a: '#FFD93D', b: '#39FF14' },
    presetConfig: { ...POLISHED_CAPTION_PRESET_CONFIG },
  }
}

export function silenceTrimPresetForProject(streamClip = false): SilenceTrimSettings {
  return streamClip ? { ...SILENCE_TRIM_STREAM_GENTLE } : { ...SILENCE_TRIM_NATURAL }
}

export type ApplyClipPolishOptions = {
  streamClip?: boolean
  exportPlatform?: ExportPlatformId | null
  hookText?: string | null
  words?: ClipWord[]
  /** When false, skip adding silence cut ranges (export toggle). */
  applySilenceCuts?: boolean
}

export function applyClipPolishToEdits(
  edits: ClipEditsV2,
  opts: ApplyClipPolishOptions = {},
): ClipEditsV2 {
  const stream = Boolean(opts.streamClip)
  let next: ClipEditsV2 = { ...edits }

  if (clipPolishFeatureEnabled('CAPTIONS')) {
    next = {
      ...next,
      captions: { ...next.captions, ...polishedCaptionPatch(stream) },
    }
    if (opts.words?.length && clipPolishFeatureEnabled('CAPTIONS')) {
      const auto = autoCaptionEmphasisIndexes(opts.words, next)
      const merged = [...new Set([...(next.captions?.emphasis ?? []), ...auto])]
      next = {
        ...next,
        captions: { ...next.captions, emphasis: merged.slice(0, 48), keywordHighlight: true },
      }
    }
  }

  if (clipPolishFeatureEnabled('ZOOM')) {
    next = {
      ...next,
      zoom: {
        enabled: true,
        intensity: 1.12,
        facecamOnly: stream || next.layout?.mode === 'screen_pip',
      },
    }
  }

  if (clipPolishFeatureEnabled('SILENCE')) {
    const st = silenceTrimPresetForProject(stream)
    next = {
      ...next,
      silenceTrim: { ...st, enabled: opts.applySilenceCuts !== false },
    }
    if (opts.applySilenceCuts !== false && opts.words?.length) {
      next = applySilenceTrimToEdits(next, opts.words, st)
    }
  }

  if (clipPolishFeatureEnabled('AUDIO')) {
    next = { ...next, loudnessLufs: -14 }
    if (next.audio?.music) {
      next = {
        ...next,
        audio: {
          ...next.audio,
          music: {
            ...next.audio.music,
            volume: Math.min(next.audio.music.volume ?? 0.25, 0.12),
            duckDepth: Math.max(next.audio.music.duckDepth ?? DEFAULT_DUCK_DEPTH, 0.85),
          },
        },
      }
    }
  }

  if (clipPolishFeatureEnabled('HOOK') && opts.hookText?.trim()) {
    const text = opts.hookText.trim()
    if (text.length >= 8 && text.split(/\s+/).length <= 12) {
      next = {
        ...next,
        hookOverlay: {
          enabled: true,
          text,
          durationMs: 2200,
        },
      }
    }
  }

  if (clipPolishFeatureEnabled('OVERLAYS') && next.brand && typeof next.brand === 'object') {
    const brand = { ...(next.brand as Record<string, unknown>) }
    brand.logoPosition = clampBrandLogoPosition(
      typeof brand.logoPosition === 'string' ? brand.logoPosition : undefined,
    )
    next = { ...next, brand }
  }

  return next
}
