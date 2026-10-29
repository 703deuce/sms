import type { ClipLayoutFacecam } from '@/lib/clips/edits'
import type { HeadlineLayer } from '@/lib/clips/layers'

export function headlinePreviewFontFamily(font: string | undefined): string {
  if (font === 'Montserrat Black') {
    return 'var(--font-clip-montserrat), Montserrat, sans-serif'
  }
  return 'var(--font-clip-anton), Anton, Impact, sans-serif'
}

export function headlinePreviewFontWeight(font: string | undefined): number {
  return font === 'Montserrat Black' ? 900 : 400
}

export function headlinePreviewBoxMetrics(
  boxWidth: number,
  boxHeight: number,
  style: HeadlineLayer['style'],
): { left: number; width: number; borderRadius: number } {
  const widthPct = style.widthPct ?? 100
  const width = (boxWidth * widthPct) / 100
  const left = (boxWidth - width) / 2
  const borderRadius = (style.radiusPx ?? 0) * (boxHeight / 1920)
  return { left, width, borderRadius }
}

export type PipCorner = NonNullable<ClipLayoutFacecam['pipCorner']>

const PIP_SLOTS: Record<PipCorner, { right?: string; left?: string; top?: string; bottom?: string }> = {
  TR: { right: '4%', top: '12%' },
  TL: { left: '4%', top: '12%' },
  BR: { right: '4%', bottom: '12%' },
  BL: { left: '4%', bottom: '12%' },
}

export function pipCornerSlotStyle(corner: PipCorner | undefined): {
  width: string
  height: string
  position: 'absolute'
  zIndex: number
  right?: string
  left?: string
  top?: string
  bottom?: string
} {
  const c = corner ?? 'BR'
  return {
    width: '28%',
    height: '22%',
    position: 'absolute',
    zIndex: 2,
    ...PIP_SLOTS[c],
  }
}

export function nearestPipCorner(clientX: number, clientY: number, rect: DOMRect): PipCorner {
  const cx = (clientX - rect.left) / rect.width
  const cy = (clientY - rect.top) / rect.height
  const corners: { id: PipCorner; x: number; y: number }[] = [
    { id: 'TL', x: 0, y: 0 },
    { id: 'TR', x: 1, y: 0 },
    { id: 'BL', x: 0, y: 1 },
    { id: 'BR', x: 1, y: 1 },
  ]
  let best: PipCorner = 'BR'
  let bestD = Infinity
  for (const c of corners) {
    const d = (cx - c.x) ** 2 + (cy - c.y) ** 2
    if (d < bestD) {
      bestD = d
      best = c.id
    }
  }
  return best
}
