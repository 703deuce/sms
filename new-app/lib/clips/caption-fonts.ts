import { cssFallbackStack } from '@/lib/clips/font-fallbacks'
import metrics from '@/lib/clips/caption-font-metrics.json'

const loggedMissing = new Set<string>()

export type UserFontMetrics = { family: string; cssEmPerAssFontsize?: number }

export type UserFontResolver = (fontId: string) => UserFontMetrics | null

export function captionFontStack(font: string, resolveUser?: UserFontResolver): string {
  if (font.startsWith('user:') && resolveUser) {
    const row = resolveUser(font.slice(5))
    if (row?.family) return `"${row.family}", sans-serif`
    return captionFontStack('Poppins')
  }
  if (font.startsWith('user:')) return captionFontStack('Poppins')
  if (font === 'Poppins') return `var(--font-poppins), ${cssFallbackStack('Poppins')}`
  if (font === 'Anton') return `var(--font-clip-anton), ${cssFallbackStack('Anton')}`
  if (font === 'Montserrat Black' || font === 'Montserrat')
    return `var(--font-clip-montserrat), ${cssFallbackStack('Montserrat')}`
  if (font === 'Bangers') return `var(--font-clip-bangers), ${cssFallbackStack('Bangers')}`
  if (font === 'Inter') return `var(--font-clip-inter), ${cssFallbackStack('Inter')}`
  if (font === 'Lato') return `var(--font-clip-lato), ${cssFallbackStack('Lato')}`
  if (font === 'Bebas Neue') return `var(--font-clip-bebas), ${cssFallbackStack('Bebas Neue')}`
  if (font === 'Archivo Black') return `var(--font-clip-archivo), ${cssFallbackStack('Archivo Black')}`
  if (font === 'Oswald') return `var(--font-clip-oswald), ${cssFallbackStack('Oswald')}`
  if (font === 'Luckiest Guy') return `var(--font-clip-luckiest), ${cssFallbackStack('Luckiest Guy')}`
  if (['Rubik', 'Gabarito', 'Fira Sans Condensed', 'DM Serif Display', 'Playfair Display', 'Caveat', 'Space Grotesk', 'Space Mono'].includes(font))
    return cssFallbackStack(font)
  return font
}

export function captionFontWeight(font: string, presetWeight: number): number {
  if (font === 'Poppins') return 800
  return presetWeight
}

export function cssEmPerAssFontsize(font: string, resolveUser?: UserFontResolver): number {
  if (font.startsWith('user:') && resolveUser) {
    const row = resolveUser(font.slice(5))
    if (row?.cssEmPerAssFontsize) return row.cssEmPerAssFontsize
    if (row?.family) return 1
    return cssEmPerAssFontsize('Poppins')
  }
  if (font.startsWith('user:')) return cssEmPerAssFontsize('Poppins')
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
