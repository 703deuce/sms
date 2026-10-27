import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'

/** Safe content rect on 1080×1920 (pixels). */
export type SafeZoneRect = {
  top: number
  bottom: number
  left: number
  right: number
  /** TikTok action rail: extra right inset below this y. */
  rightRailFromY?: number
  rightRailExtra?: number
}

export const PLATFORM_SAFE_ZONE_1080x1920: Record<ExportPlatformId, SafeZoneRect> = {
  tiktok: {
    top: 240,
    bottom: 660,
    left: 120,
    right: 120,
    rightRailFromY: 840,
    rightRailExtra: 180,
  },
  youtube_shorts: { top: 380, bottom: 390, left: 60, right: 201 },
  instagram_reels: { top: 250, bottom: 319, left: 86, right: 119 },
}

const CANVAS_W = 1080
const CANVAS_H = 1920

export function effectiveRightInset(zone: SafeZoneRect, yPx: number): number {
  if (
    zone.rightRailFromY != null &&
    zone.rightRailExtra != null &&
    yPx >= zone.rightRailFromY
  ) {
    return zone.right + zone.rightRailExtra
  }
  return zone.right
}

export function clampPointToSafeZone(
  x: number,
  y: number,
  platform: ExportPlatformId,
): { x: number; y: number } {
  const z = PLATFORM_SAFE_ZONE_1080x1920[platform]
  const right = CANVAS_W - effectiveRightInset(z, y)
  const bottom = CANVAS_H - z.bottom
  return {
    x: Math.min(right, Math.max(z.left, x)),
    y: Math.min(bottom, Math.max(z.top, y)),
  }
}

/** Logo must not sit in bottom-right (platform chrome). */
export function clampBrandLogoPosition(pos?: string): string {
  const p = (pos || 'bottom_left').toLowerCase()
  if (p === 'bottom_right' || p === 'bottom-right') return 'bottom_left'
  return p.replace('-', '_')
}

export function countPolishOverlays(edits: {
  captions?: { enabled?: boolean }
  hookOverlay?: { enabled?: boolean; text?: string }
  brand?: { logoKey?: string }
}): number {
  let n = 0
  if (edits.captions?.enabled !== false) n += 1
  if (edits.hookOverlay?.enabled && edits.hookOverlay.text?.trim()) n += 1
  const brand = edits.brand as { logoKey?: string } | undefined
  if (brand?.logoKey) n += 1
  return n
}

export function overlayCountWithinLimit(count: number, max = 3): boolean {
  return count <= max
}
