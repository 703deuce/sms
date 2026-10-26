/** Shared stack layout math (parity with worker render_stack.py). */

export type NormBox = { x: number; y: number; w: number; h: number }

export function stackHeights(split: number, outH = 1920): { faceH: number; gameH: number } {
  const s = Math.max(0.25, Math.min(0.5, split))
  const faceH = Math.round((outH * s) / 2) * 2
  const gameH = outH - faceH
  return { faceH, gameH }
}

export function cropPx(box: NormBox, srcW: number, srcH: number) {
  const w = Math.max(8, Math.round(box.w * srcW))
  const h = Math.max(8, Math.round(box.h * srcH))
  let x = Math.round(box.x * srcW)
  let y = Math.round(box.y * srcH)
  x = Math.max(0, Math.min(x, srcW - w))
  y = Math.max(0, Math.min(y, srcH - h))
  return { x, y, w, h }
}
