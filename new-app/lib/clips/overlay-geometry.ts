/** Shared overlay geometry — parity with worker/clips_worker/overlay_geometry.py */
import geom from '@/lib/clips/overlay-geometry.json'

type BadgeRectSpec = {
  widthPx?: number
  heightPx?: number
  logoSizePx?: number
  padPx?: number
  centerX?: boolean
  padLeftPx?: number
  linkGapPx?: number
  insetLeftPx?: number
}

const DEFAULTS = geom as typeof geom & {
  badgeRect: {
    fitTopBand: BadgeRectSpec
    exportBar: BadgeRectSpec
  }
  exportBar: { badgeW: number; badgeH: number; sourceInsetY: number }
  baseH: number
}

function scalePx(px: number, playH: number): number {
  const baseH = Number(DEFAULTS.baseH || 1920)
  return Math.max(1, Math.round((px * playH) / baseH))
}

function scalePxW(px: number, playW: number): number {
  const baseH = Number(DEFAULTS.baseH || 1920)
  return Math.max(1, Math.round((px * playW) / baseH))
}

export function headlineStyles(): Record<string, { textColor: string; boxColor: string; radiusPx: number }> {
  return { ...(DEFAULTS.headlineStyles as Record<string, { textColor: string; boxColor: string; radiusPx: number }>) }
}

export function headlineStyleForPreset(preset: string) {
  const styles = headlineStyles()
  return styles[preset] ?? styles.stream_white_box ?? { textColor: '#000000', boxColor: '#FFFFFF', radiusPx: 0 }
}

/** Pixel rect {x,y,w,h} for platform badge overlay. */
export function badgeRect(
  placement: string,
  playW: number,
  playH: number,
  opts?: { videoY?: number; videoH?: number; badgeY?: number | null },
): { x: number; y: number; w: number; h: number } {
  const br = DEFAULTS.badgeRect ?? {}
  const videoY = opts?.videoY ?? 0
  const videoH = opts?.videoH ?? 0
  const badgeY = opts?.badgeY

  if (placement === 'fit_top_band') {
    const spec = br.fitTopBand ?? {}
    const w = scalePx(Number(spec.widthPx ?? 200), playH)
    const h = scalePx(Number(spec.heightPx ?? 32), playH)
    const y =
      badgeY != null
        ? badgeY
        : Math.max(0, videoY + videoH - scalePx(40, playH) - h)
    const x = spec.centerX ? Math.floor((playW - w) / 2) : scalePxW(16, playW)
    return { x, y, w, h }
  }

  const spec = br.exportBar ?? {}
  const w = scalePxW(Number(spec.widthPx ?? DEFAULTS.exportBar.badgeW), playW)
  const h = scalePx(Number(spec.heightPx ?? DEFAULTS.exportBar.badgeH), playH)
  const inset = scalePxW(Number(spec.insetLeftPx ?? 16), playW)
  const insetY = scalePx(Number(DEFAULTS.exportBar.sourceInsetY ?? 12), playH)
  const y = videoH ? videoY + videoH - h - insetY : playH - h - insetY
  return { x: inset, y, w, h }
}

export { geom as overlayGeometryJson }
