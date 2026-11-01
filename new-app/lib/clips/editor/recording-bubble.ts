/** Geometry for a circular camera bubble on a screen-recording canvas (PR-07). */

export type BubbleCorner = 'se' | 'sw' | 'ne' | 'nw'
export type BubbleSize = 'S' | 'M' | 'L'

const SIZE_FRAC: Record<BubbleSize, number> = { S: 0.16, M: 0.22, L: 0.28 }
const MARGIN_FRAC = 0.025

/** Even dimensions with long side capped at 1920 (export-friendly). */
export function evenCanvasDims(srcW: number, srcH: number): { w: number; h: number } {
  let w = Math.max(2, Math.round(srcW))
  let h = Math.max(2, Math.round(srcH))
  const long = Math.max(w, h)
  if (long > 1920) {
    const s = 1920 / long
    w = Math.max(2, Math.round(w * s))
    h = Math.max(2, Math.round(h * s))
  }
  if (w % 2) w += 1
  if (h % 2) h += 1
  return { w, h }
}

/** Circle diameter and top-left in canvas pixels. */
export function bubbleRect(
  canvasW: number,
  canvasH: number,
  corner: BubbleCorner,
  size: BubbleSize,
): { x: number; y: number; d: number } {
  const d = Math.round(canvasW * SIZE_FRAC[size])
  const m = Math.round(canvasW * MARGIN_FRAC)
  const x = corner.includes('w') ? m : Math.max(m, canvasW - m - d)
  const y = corner.startsWith('n') ? m : Math.max(m, canvasH - m - d)
  return { x, y, d }
}
