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
  /** ASS marginV % from bottom — lifts captions above in-app chrome */
  captionSafeMarginVPct: number
  captionPosition: 'bottom' | 'middle'
}

export const EXPORT_PLATFORM_PRESETS: Record<ExportPlatformId, ExportPlatformPreset> = {
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    aspect: '9:16',
    resolution: '1080p',
    maxDurationSec: 60,
    captionSafeMarginVPct: 18,
    captionPosition: 'bottom',
  },
  youtube_shorts: {
    id: 'youtube_shorts',
    label: 'YouTube Shorts',
    aspect: '9:16',
    resolution: '1080p',
    maxDurationSec: 60,
    captionSafeMarginVPct: 14,
    captionPosition: 'bottom',
  },
  instagram_reels: {
    id: 'instagram_reels',
    label: 'Instagram Reels',
    aspect: '9:16',
    resolution: '1080p',
    maxDurationSec: 90,
    captionSafeMarginVPct: 16,
    captionPosition: 'bottom',
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
  return {
    ...edits,
    aspectRatio: preset.aspect,
    captions: {
      ...cap,
      position: preset.captionPosition,
      marginVPct: preset.captionSafeMarginVPct,
      presetConfig: {
        ...(cap.presetConfig || {}),
        marginVPct: preset.captionSafeMarginVPct,
      },
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
  const maxMs = EXPORT_PLATFORM_PRESETS[platform].maxDurationSec * 1000
  if (durationMs <= maxMs) return null
  const over = Math.round((durationMs - maxMs) / 1000)
  return `This clip is ~${over}s longer than ${exportPlatformLabel(platform)}’s ${EXPORT_PLATFORM_PRESETS[platform].maxDurationSec}s limit. Trim in the editor or export anyway for other uses.`
}
