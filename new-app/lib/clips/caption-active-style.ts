/** Contrast text on highlight fill (mirrors caption-overlay preview). */
export function captionHighlightContrastText(hex: string): '#000000' | '#FFFFFF' {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#000000'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.5 ? '#000000' : '#FFFFFF'
}
