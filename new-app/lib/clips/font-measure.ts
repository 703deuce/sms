import Anton from '@/lib/clips/font-metrics/Anton.json'
import MontserratBlack from '@/lib/clips/font-metrics/MontserratBlack.json'
import Poppins from '@/lib/clips/font-metrics/Poppins.json'

export type FontMetrics = typeof Anton
const FONTS: Record<string, FontMetrics> = { Anton, 'Montserrat Black': MontserratBlack, Poppins }
const EMOJI_ADV_EM = 1.25

export function fontMetrics(font: string | undefined): FontMetrics {
  return FONTS[font ?? 'Anton'] ?? FONTS.Anton
}

export function isEmojiCp(cp: number): boolean {
  return (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf)
}

/** Advance width of `text` in em (no kerning; fit keeps ≥4% slack for it). */
export function textWidthEm(text: string, font: string | undefined): number {
  const m = fontMetrics(font)
  const adv = m.adv as Record<string, number>
  let u = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    u += isEmojiCp(cp) ? EMOJI_ADV_EM * m.unitsPerEm : (adv[String(cp)] ?? m.defaultAdv)
  }
  return u / m.unitsPerEm
}

/** CSS px em → libass Fontsize for the same rendered size. */
export function assFontsizeForEmPx(emPx: number, font: string | undefined): number {
  return Math.round(emPx / fontMetrics(font).assEmPerFontsize)
}

/** libass Fontsize → CSS em px for preview parity. */
export function emPxForAssFontsize(assFontsize: number, font: string | undefined): number {
  return assFontsize * fontMetrics(font).assEmPerFontsize
}

/** @deprecated use fontMetrics().assEmPerFontsize */
export function cssEmPerAssFontsize(font: string | undefined): number {
  return fontMetrics(font).assEmPerFontsize
}
