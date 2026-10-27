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

export function clampCaptionExportStyle(
  captions: ClipEditsV2['captions'] | undefined,
  playH = 1280,
): CaptionExportStyle {
  const preset = resolvePreset(captions?.presetId)
  let marginVPct = Math.max(
    CAPTION_MIN_MARGIN_V_PCT,
    captions?.marginVPct ?? preset.marginVPct,
  )
  let sizePct = Math.min(CAPTION_MAX_SIZE_PCT, captions?.size ?? preset.sizePct)
  sizePct = Math.max(3, sizePct)
  const fontsize = (sizePct / 100) * playH
  const marginPx = (marginVPct / 100) * playH
  const maxMarginPx = playH * SAFE_TEXT_BAND - fontsize * 1.45
  let safeOk = marginPx <= maxMarginPx && marginVPct >= CAPTION_MIN_MARGIN_V_PCT
  if (!safeOk && maxMarginPx > 0) {
    marginVPct = Math.max(CAPTION_MIN_MARGIN_V_PCT, (maxMarginPx / playH) * 100)
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
