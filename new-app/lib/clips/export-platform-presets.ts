import { clampCaptionExportStyle } from '@/lib/clips/caption-safe-area'
import { PLATFORM_SAFE_ZONE_1080x1920 } from '@/lib/clips/overlay-safe-zone'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { outputDurationMs } from '@/lib/clips/edits'

/** Social export targets (download-only — no account connections). */
export const EXPORT_PLATFORM_IDS = ['tiktok', 'youtube_shorts', 'instagram_reels'] as const
export type ExportPlatformId = (typeof EXPORT_PLATFORM_IDS)[number]

export type ExportPlatformPreset = {
  id: ExportPlatformId
  label: string
  aspect: ExportAspect
  /** Recommended export height tier */
  resolution: '720p' | '1080p'
  maxDurationSec: number
  /** Suggested target band (user can still export 15–90s). */
  recommendedMinSec: number
  recommendedMaxSec: number
  /** ASS marginV % from bottom — lifts captions above in-app chrome */
  captionSafeMarginVPct: number
  captionPosition: 'bottom' | 'middle'
  /** Min Y for headline drawtext at 1080×1920 (platform top chrome). */
  headlineTextMinYPx: number
}

export const EXPORT_PLATFORM_PRESETS: Record<ExportPlatformId, ExportPlatformPreset> = {
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    aspect: '9:16',
    resolution: '1080p',
    maxDurationSec: 90,
    recommendedMinSec: 15,
    recommendedMaxSec: 35,
    captionSafeMarginVPct: 18,
    captionPosition: 'bottom',
    headlineTextMinYPx: 260,
  },
  youtube_shorts: {
    id: 'youtube_shorts',
    label: 'YouTube Shorts',
    aspect: '9:16',
    resolution: '1080p',
    maxDurationSec: 90,
    recommendedMinSec: 15,
    recommendedMaxSec: 30,
    captionSafeMarginVPct: 14,
    captionPosition: 'bottom',
    headlineTextMinYPx: 380,
  },
  instagram_reels: {
    id: 'instagram_reels',
    label: 'Instagram Reels',
    aspect: '9:16',
    resolution: '1080p',
    maxDurationSec: 90,
    recommendedMinSec: 15,
    recommendedMaxSec: 30,
    captionSafeMarginVPct: 16,
    captionPosition: 'bottom',
    headlineTextMinYPx: 250,
  },
}

export function exportPlatformLabel(id: ExportPlatformId): string {
  return EXPORT_PLATFORM_PRESETS[id].label
}

/** Merge platform safe zones and aspect into edits for a one-shot export render. */
export function applyExportPlatformToEdits(
  edits: ClipEditsV2,
  platform: ExportPlatformId,
): ClipEditsV2 {
  const preset = EXPORT_PLATFORM_PRESETS[platform]
  const cap = edits.captions || {}
  const merged = {
    ...edits,
    aspectRatio: preset.aspect,
    captions: {
      ...cap,
      position: preset.captionPosition,
      marginVPct: Math.max(cap.marginVPct ?? 0, preset.captionSafeMarginVPct),
      presetConfig: {
        ...(cap.presetConfig || {}),
        marginVPct: preset.captionSafeMarginVPct,
      },
    },
  }
  const zone = PLATFORM_SAFE_ZONE_1080x1920[platform]
  const bottomMarginPct = Math.max(
    merged.captions.marginVPct ?? 0,
    preset.captionSafeMarginVPct,
    (zone.bottom / 1920) * 100,
  )
  const safe = clampCaptionExportStyle(
    { ...merged.captions, marginVPct: bottomMarginPct },
    preset.resolution === '1080p' ? 1920 : 1280,
  )
  const tpl = merged.exportTemplate || {}
  return {
    ...merged,
    captions: {
      ...merged.captions,
      marginVPct: safe.marginVPct,
      size: safe.sizePct,
      position: safe.position as ClipEditsV2['captions']['position'],
    },
    exportTemplate: {
      ...tpl,
      exportPlatformId: platform,
    },
  }
}

export function clipDurationMsForExport(edits: ClipEditsV2): number {
  return outputDurationMs({ ...edits, v: 2 })
}

export function exportPlatformDurationWarning(
  platform: ExportPlatformId,
  durationMs: number,
): string | null {
  const p = EXPORT_PLATFORM_PRESETS[platform]
  const maxMs = p.maxDurationSec * 1000
  if (durationMs > maxMs) {
    const over = Math.round((durationMs - maxMs) / 1000)
    return `This clip is ~${over}s longer than ${exportPlatformLabel(platform)}’s ${p.maxDurationSec}s limit. Trim in the editor or export anyway for other uses.`
  }
  const sec = durationMs / 1000
  if (sec > p.recommendedMaxSec + 15) {
    return `Polished clips for ${exportPlatformLabel(platform)} usually land ${p.recommendedMinSec}–${p.recommendedMaxSec}s. Yours is ~${Math.round(sec)}s — trim if you want a tighter hook.`
  }
  if (sec < p.recommendedMinSec - 2) {
    return `Under ${p.recommendedMinSec}s can feel abrupt on ${exportPlatformLabel(platform)}. Add context or export anyway.`
  }
  return null
}
