/** FIX2 R3: pure geometry for the caption drag box (CanvasDirectHandles). */
export type RectLike = { left: number; top: number; width: number; height: number }

export function toRectLike(r: RectLike): RectLike {
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/** true when the caption moved/resized by more than `eps` px (or appeared/disappeared). */
export function rectChanged(a: RectLike | null, b: RectLike | null, eps = 0.5): boolean {
  if (!a || !b) return a !== b
  return (
    Math.abs(a.left - b.left) > eps ||
    Math.abs(a.top - b.top) > eps ||
    Math.abs(a.width - b.width) > eps ||
    Math.abs(a.height - b.height) > eps
  )
}

/** Caption rect (viewport px) -> style for a box absolutely positioned inside `box` (viewport px), padded. */
export function captionDragBoxStyle(cap: RectLike, box: Pick<RectLike, 'left' | 'top'>, pad = 4) {
  return {
    left: cap.left - box.left - pad,
    top: cap.top - box.top - pad,
    width: cap.width + pad * 2,
    height: cap.height + pad * 2,
  }
}

/**
 * Pointer delta (px) -> capX / capY delta (percent of frame). The caption renders at dx = +capX%·W and
 * dy = −capY%·H (libass + DOM overlay), so dragging DOWN must LOWER capY.
 */
export function captionDragDelta(dx: number, dy: number, w: number, h: number): { dCapX: number; dCapY: number } {
  const dCapX = dx === 0 ? 0 : (dx / Math.max(1, w)) * 100
  const dCapY = dy === 0 ? 0 : -(dy / Math.max(1, h)) * 100
  return { dCapX, dCapY }
}
