import metrics from '@/lib/clips/caption-font-metrics.json'

const loggedMissing = new Set<string>()

export function captionFontStack(font: string): string {
  if (font === 'Poppins') return 'var(--font-poppins), Poppins, sans-serif'
  if (font === 'Anton') return 'var(--font-clip-anton), Anton, Impact, sans-serif'
  if (font === 'Montserrat Black' || font === 'Montserrat')
    return 'var(--font-clip-montserrat), Montserrat, sans-serif'
  return font
}

export function captionFontWeight(font: string, presetWeight: number): number {
  if (font === 'Poppins') return 800
  return presetWeight
}

export function cssEmPerAssFontsize(font: string): number {
  const row = (metrics as Record<string, { cssEmPerAssFontsize?: number }>)[font]
  if (row?.cssEmPerAssFontsize) return row.cssEmPerAssFontsize
  if (!loggedMissing.has(font)) {
    loggedMissing.add(font)
    console.warn(`[clipper:captions] metrics_missing font=${font}`)
  }
  return 1
}

/** ASS outline width in preview px (mirrors caption-overlay WebkitTextStroke). */
export function previewCaptionStrokePx(outlineW: number, boxHeightPx: number, exportPlayH: number): number {
  if (!outlineW || boxHeightPx <= 0 || exportPlayH <= 0) return 0
  return 2 * outlineW * (boxHeightPx / exportPlayH)
}
