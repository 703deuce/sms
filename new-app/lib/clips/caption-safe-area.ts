import { CAPTION_PRESETS, presetSlugToId, resolvePreset } from '@/lib/clips/caption-presets'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { EXPORT_PLATFORM_PRESETS } from '@/lib/clips/export-platform-presets'

export const CAPTION_MIN_MARGIN_V_PCT = 12
export const CAPTION_MAX_SIZE_PCT = 10.5

/** Max caption stack height as fraction of frame (leaves headroom for platform chrome). */
const SAFE_TEXT_BAND = 0.82

export type CaptionExportStyle = {
  marginVPct: number
  sizePct: number
  position: string
  safeOk: boolean
}

/** G3a: bottom safe margin by frame shape (worker caption_min_margin_v_pct): 9:16 12, 4:5 10, 1:1 8, 16:9 6. */
export function captionMinMarginVPct(playW: number | undefined, playH: number): number {
  if (!playW || !playH) return CAPTION_MIN_MARGIN_V_PCT
  const r = playW / playH
  if (r >= 1.5) return 6
  if (r >= 0.95) return 8
  if (r >= 0.75) return 10
  return CAPTION_MIN_MARGIN_V_PCT
}

export function clampCaptionExportStyle(
  captions: ClipEditsV2['captions'] | undefined,
  playH = 1280,
  playW?: number,
): CaptionExportStyle {
  const preset = resolvePreset(captions?.presetId)
  const minM = captionMinMarginVPct(playW, playH)
  let marginVPct = Math.max(
    minM,
    captions?.marginVPct ?? preset.marginVPct,
  )
  let sizePct = Math.min(CAPTION_MAX_SIZE_PCT, captions?.size ?? preset.sizePct)
  sizePct = Math.max(3, sizePct)
  const fontsize = (sizePct / 100) * playH
  const marginPx = (marginVPct / 100) * playH
  const maxMarginPx = playH * SAFE_TEXT_BAND - fontsize * 1.45
  let safeOk = marginPx <= maxMarginPx && marginVPct >= minM
  if (!safeOk && maxMarginPx > 0) {
    marginVPct = Math.max(minM, (maxMarginPx / playH) * 100)
    safeOk = true
  }
  return {
    marginVPct: Math.round(marginVPct * 10) / 10,
    sizePct: Math.round(sizePct * 10) / 10,
    position: captions?.position ?? preset.position,
    safeOk,
  }
}

/** Every built-in caption preset must pass export safe-area at 9:16. */
export function verifyCaptionPresetsSafeArea(playH = 1920): { presetId: string; safeOk: boolean }[] {
  return CAPTION_PRESETS.map((p) => {
    const presetId = presetSlugToId(p.slug)
    const style = clampCaptionExportStyle({ presetId }, playH)
    return { presetId, safeOk: style.safeOk }
  })
}

export function minPlatformCaptionMarginVPct(): number {
  return Math.min(...Object.values(EXPORT_PLATFORM_PRESETS).map((p) => p.captionSafeMarginVPct))
}

/** Preview bottom offset % — mirrors worker clamp_caption_export_style marginVPct. */
export function previewCaptionBottomPct(
  captions: ClipEditsV2['captions'] | undefined,
  playH = 1920,
  playW?: number,
): number {
  return clampCaptionExportStyle(captions, playH, playW).marginVPct
}

/** Preview top offset % for alignment 8 — same clamped marginVPct as export. */
export function previewCaptionTopPct(
  captions: ClipEditsV2['captions'] | undefined,
  playH = 1920,
  playW?: number,
): number {
  return clampCaptionExportStyle(captions, playH, playW).marginVPct
}
