'use client'

import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import {
  PLATFORM_SAFE_ZONE_1080x1920,
  effectiveRightInset,
  type SafeZoneRect,
} from '@/lib/clips/overlay-safe-zone'

export function PreviewSafeZoneOverlay({
  boxWidth,
  boxHeight,
  platform,
}: {
  boxWidth: number
  boxHeight: number
  platform: ExportPlatformId
}) {
  if (boxWidth <= 0 || boxHeight <= 0) return null
  const zone = PLATFORM_SAFE_ZONE_1080x1920[platform] ?? PLATFORM_SAFE_ZONE_1080x1920.tiktok
  const sx = boxWidth / 1080
  const sy = boxHeight / 1920
  const left = zone.left * sx
  const top = zone.top * sy
  const rightInset = (1080 - zone.right) * sx
  const bottomInset = zone.bottom * sy
  const w = boxWidth - left - rightInset
  const h = boxHeight - top - bottomInset

  return (
    <div className="pointer-events-none absolute inset-0 z-[22]" data-testid="preview-safe-zone">
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute border-2 border-dashed border-amber-400/90"
        style={{ left, top, width: w, height: h }}
      />
      {zone.rightRailFromY != null && zone.rightRailExtra != null ? (
        <RailShade zone={zone} sx={sx} sy={sy} boxWidth={boxWidth} boxHeight={boxHeight} />
      ) : null}
    </div>
  )
}

function RailShade({
  zone,
  sx,
  sy,
  boxWidth,
  boxHeight,
}: {
  zone: SafeZoneRect
  sx: number
  sy: number
  boxWidth: number
  boxHeight: number
}) {
  const fromY = (zone.rightRailFromY ?? 0) * sy
  const extraW = (zone.rightRailExtra ?? 0) * sx
  if (extraW <= 0) return null
  return (
    <div
      className="absolute bg-black/40"
      style={{
        top: fromY,
        right: 0,
        width: extraW + zone.right * sx,
        height: boxHeight - fromY,
      }}
    />
  )
}

export function captionBlockBottomPx(boxHeight: number, marginVPct: number): number {
  return boxHeight * (1 - marginVPct / 100)
}

export function captionInBottomUnsafeBand(
  platform: ExportPlatformId,
  boxHeight: number,
  marginVPct: number,
): boolean {
  const zone = PLATFORM_SAFE_ZONE_1080x1920[platform] ?? PLATFORM_SAFE_ZONE_1080x1920.tiktok
  const bottomEdge = captionBlockBottomPx(boxHeight, marginVPct)
  const unsafeFrom = boxHeight - zone.bottom * (boxHeight / 1920)
  return bottomEdge >= unsafeFrom - 1
}

export function moveUpMarginVPct(platform: ExportPlatformId): number {
  const zone = PLATFORM_SAFE_ZONE_1080x1920[platform] ?? PLATFORM_SAFE_ZONE_1080x1920.tiktok
  return Math.min(28, Math.ceil((zone.bottom / 1920) * 100) + 1)
}
