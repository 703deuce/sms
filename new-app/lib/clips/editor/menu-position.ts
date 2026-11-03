/** FIX2 R4: keep a fixed-position menu fully inside the viewport. */
export function clampMenuPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
  margin = 8,
): { left: number; top: number } {
  const left = Math.max(margin, Math.min(x, vw - w - margin))
  const top = Math.max(margin, Math.min(y, vh - h - margin))
  return { left, top }
}
