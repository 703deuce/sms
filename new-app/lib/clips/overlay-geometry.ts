/** Shared overlay geometry — parity with worker/clips_worker/overlay_geometry.py */
import geom from '@/lib/clips/overlay-geometry.json'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { headlineLayerPlacement } from '@/lib/clips/headline-band-layout'
import { usesStreamHeadlineBandOverlay } from '@/lib/clips/stream-compose-layout'

type BadgeGeom = {
  hPx?: number
  padXPx?: number
  logoPx?: number
  gapPx?: number
  fontPx?: number
  charW?: number
}

const DEFAULTS = geom as typeof geom & {
  badge?: BadgeGeom
  exportBar: { sourceInsetY: number }
  baseH: number
}

function roundPx(v: number): number {
  return Math.floor(v + 0.5)
}

function scalePx(px: number, playH: number): number {
  const baseH = Number(DEFAULTS.baseH || 1920)
  return Math.max(1, roundPx((px * playH) / baseH))
}

export function headlineStyles(): Record<string, { textColor: string; boxColor: string; radiusPx: number }> {
  return { ...(DEFAULTS.headlineStyles as Record<string, { textColor: string; boxColor: string; radiusPx: number }>) }
}

export function headlineStyleForPreset(preset: string) {
  const styles = headlineStyles()
  return styles[preset] ?? styles.stream_white_box ?? { textColor: '#000000', boxColor: '#FFFFFF', radiusPx: 0 }
}

export function badgePlacementForLayout(layoutMode: string, edits?: ClipEditsV2): 'fit_top_band' | 'export_bar' {
  if (edits && usesStreamHeadlineBandOverlay(edits)) return 'fit_top_band'
  return headlineLayerPlacement(layoutMode)
}

/** Pixel rect {x,y,w,h} for platform badge overlay (play space). */
export function badgeRect(
  placement: string,
  playW: number,
  playH: number,
  opts?: {
    text?: string
    showLogo?: boolean
    videoY?: number
    videoH?: number
    badgeY?: number | null
    anchorTopGap?: boolean
  },
): { x: number; y: number; w: number; h: number } {
  const badge = DEFAULTS.badge ?? {}
  const s = playH / (DEFAULTS.baseH || 1920)
  const h = Math.max(8, roundPx((badge.hPx ?? 64) * s))
  const padX = badge.padXPx ?? 22
  const logoPx = badge.logoPx ?? 40
  const gapPx = badge.gapPx ?? 12
  const fontPx = badge.fontPx ?? 32
  const charW = badge.charW ?? 0.62
  const text = (opts?.text ?? '').slice(0, 24)
  const showLogo = Boolean(opts?.showLogo)
  let w = roundPx((2 * padX + (showLogo ? logoPx + gapPx : 0) + text.length * fontPx * charW) * s)
  const margin = scalePx(24, playH)
  w = Math.max(h, Math.min(w, playW - 2 * margin))
  const x = scalePx(24, playW)
  const y = scalePx(24, playH)
  return { x, y, w, h }
}

/** Pixel rect for follow sticker (center xNorm/yNorm, play space). */
/** Pixel rect {x,y,w,h} for follow sticker (parity with worker overlay_geometry.sticker_rect). */
export function stickerRectPx(
  playW: number,
  playH: number,
  xNorm: number,
  yNorm: number,
  anchor?: string | null,
): { x: number; y: number; w: number; h: number } {
  const spec = (DEFAULTS as { stickerRect?: { wFrac?: number; hFrac?: number; marginPx?: number } }).stickerRect ?? {}
  const s = playH / (DEFAULTS.baseH || 1920)
  const margin = scalePx(spec.marginPx ?? 16, playH)
  const w = Math.max(80, roundPx(playW * (spec.wFrac ?? 0.22)))
  const h = Math.max(28, roundPx(playH * (spec.hFrac ?? 0.04)))
  const cx = roundPx(xNorm * playW)
  const cy = roundPx(yNorm * playH)
  const anch = (anchor ?? 'center').toUpperCase()
  let x: number
  let y: number
  if (anch === 'TL') {
    x = cx
    y = cy
  } else if (anch === 'TR') {
    x = cx - w
    y = cy
  } else if (anch === 'BL') {
    x = cx
    y = cy - h
  } else if (anch === 'BR') {
    x = cx - w
    y = cy - h
  } else {
    x = cx - Math.floor(w / 2)
    y = cy - Math.floor(h / 2)
  }
  x = Math.max(margin, Math.min(x, playW - w - margin))
  y = Math.max(margin, Math.min(y, playH - h - margin))
  return { x, y, w, h }
}

export function stickerRect(
  playW: number,
  playH: number,
  xNorm: number,
  yNorm: number,
): { left: number; top: number; width: number; height: number } {
  const r = stickerRectPx(playW, playH, xNorm, yNorm, 'center')
  return { left: r.x, top: r.y, width: r.w, height: r.h }
}

export function stickerVisible(
  timing: 'always' | 'intro' | 'outro' | undefined,
  durationMs: number,
  outputMs: number,
  totalMs: number,
): boolean {
  const d = durationMs
  if (timing === 'intro') return outputMs <= d
  if (timing === 'outro') return totalMs > 0 && outputMs >= Math.max(0, totalMs - d)
  return true
}

export { geom as overlayGeometryJson }
