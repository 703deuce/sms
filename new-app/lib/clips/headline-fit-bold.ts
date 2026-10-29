import { textWidthEm } from '@/lib/clips/font-measure'

export type BoldFit = { lines: string[]; fontPx: number; barH: number }
export type BoldFitOpts = {
  boxW: number
  maxBarH: number
  maxFontPx: number
  minFontPx: number
  lineHeight: number
  padEm: number
  maxLines: number
}

function balancedWrap(words: string[], n: number, font: string): { lines: string[]; widestEm: number } {
  let best = { lines: [words.join(' ')], widestEm: textWidthEm(words.join(' '), font) }
  if (n <= 1) return best
  const rec = (start: number, left: number, acc: string[]) => {
    if (left === 1) {
      const lines = [...acc, words.slice(start).join(' ')]
      const widestEm = Math.max(...lines.map((l) => textWidthEm(l, font)))
      if (widestEm < best.widestEm) best = { lines, widestEm }
      return
    }
    for (let i = start + 1; i <= words.length - (left - 1); i++) rec(i, left - 1, [...acc, words.slice(start, i).join(' ')])
  }
  rec(0, n, [])
  return best
}

export function fitBoldNewsHeadline(text: string, font: string, o: BoldFitOpts): BoldFit {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return { lines: [], fontPx: 0, barH: 0 }
  let best: BoldFit | null = null
  for (let n = 1; n <= Math.min(o.maxLines, words.length); n++) {
    const { lines, widestEm } = balancedWrap(words, n, font)
    const byW = o.boxW / widestEm
    const byH = o.maxBarH / (n * o.lineHeight + 2 * o.padEm)
    const fontPx = Math.floor(Math.min(byW, byH, o.maxFontPx))
    if (!best || fontPx > best.fontPx) best = { lines, fontPx, barH: 0 }
  }
  const fit = best!
  fit.fontPx = Math.max(o.minFontPx, fit.fontPx)
  fit.barH = Math.ceil(fit.fontPx * (fit.lines.length * o.lineHeight + 2 * o.padEm))
  return fit
}
