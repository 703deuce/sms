import { wrapHeadlineDisplayLines } from '@/lib/clips/export-template'

const MAX_LINES = 4
const MIN_CHARS_PER_LINE = 14
const DEFAULT_CHARS_PER_LINE = 22

/** Wrap headline body without dropping words (parity target for export + preview). */
export function wrapHeadlineLinesFull(
  body: string,
  maxCharsPerLine = DEFAULT_CHARS_PER_LINE,
  maxLines = MAX_LINES,
): string[] {
  const trimmed = body.trim()
  if (!trimmed) return []
  const words = trimmed.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur: string[] = []
  for (const w of words) {
    const trial = [...cur, w].join(' ')
    if (trial.length > maxCharsPerLine && cur.length > 0) {
      lines.push(cur.join(' '))
      cur = [w]
      if (lines.length >= maxLines) break
    } else {
      cur.push(w)
    }
  }
  if (lines.length >= maxLines && cur.length) {
    const tail = cur.join(' ')
    const last = lines[maxLines - 1]
    lines[maxLines - 1] = last ? `${last} ${tail}`.trim() : tail
    cur = []
  } else if (cur.length && lines.length < maxLines) {
    lines.push(cur.join(' '))
  }
  return lines.slice(0, maxLines)
}

function ellipsizeLine(line: string, maxChars: number): string {
  if (line.length <= maxChars) return line
  if (maxChars <= 3) return line.slice(0, maxChars)
  return `${line.slice(0, maxChars - 1).trimEnd()}…`
}

/** Estimate max chars per line from box width and font size (Anton-ish width factor). */
export function headlineCharsPerLineForBox(boxWidthPx: number, fontPx: number): number {
  const charW = Math.max(8, fontPx * 0.52)
  return Math.max(MIN_CHARS_PER_LINE, Math.floor((boxWidthPx * 0.94) / charW))
}

const BOLD_NEWS_WIDTH_FRAC = 0.96
const BOLD_NEWS_MAX_BAR_FRAC = 0.88
const BOLD_NEWS_CHAR_WIDTH_FRAC = 0.48

function estimateLineWidthPx(line: string, fontPx: number, charWidthFrac: number): number {
  return line.length * fontPx * charWidthFrac
}

/** Fit headline into box: shrink font / tighten wrap — never truncate words. */
export function fitHeadlineDisplayForBox(
  formatted: string,
  boxWidthPx: number,
  boxHeightPx: number,
  opts?: { maxBarFrac?: number; widthFrac?: number; boldNews?: boolean },
): { lines: string[]; fontPx: number } {
  const trimmed = formatted.trim()
  if (!trimmed || boxWidthPx <= 0 || boxHeightPx <= 0) {
    return { lines: [], fontPx: 12 }
  }
  const boldNews = opts?.boldNews ?? false
  const widthFrac = opts?.widthFrac ?? (boldNews ? BOLD_NEWS_WIDTH_FRAC : 0.94)
  const maxBarFrac = opts?.maxBarFrac ?? (boldNews ? BOLD_NEWS_MAX_BAR_FRAC : 0.24)
  const charWidthFrac = boldNews ? BOLD_NEWS_CHAR_WIDTH_FRAC : 0.52
  const targetWidth = boxWidthPx * widthFrac
  const emojiTail = (trimmed.match(/(\p{Extended_Pictographic}+)$/u) || [])[0] || ''
  const body = trimmed.slice(0, trimmed.length - emojiTail.length).trim()
  const emojis = [...emojiTail].slice(0, 2).join('')

  let fontPx = Math.max(
    12,
    boldNews
      ? Math.min(boxHeightPx * 0.46, targetWidth / Math.max(MIN_CHARS_PER_LINE, 8))
      : Math.min(boxHeightPx * 0.45, (boxHeightPx * 0.52) / 3),
  )
  const maxBarH = boxHeightPx * maxBarFrac
  let lines: string[] = []
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const cpl = headlineCharsPerLineForBox(boxWidthPx, fontPx)
    lines = wrapHeadlineLinesFull(body, cpl, MAX_LINES)
    const lineH = fontPx * 1.05
    const totalH = lineH * Math.max(1, lines.length)
    const widest = Math.max(0, ...lines.map((l) => estimateLineWidthPx(l, fontPx, charWidthFrac)))
    const longestChars = Math.max(0, ...lines.map((l) => l.length))
    if (totalH <= maxBarH && widest <= targetWidth && longestChars <= cpl + 1) break
    fontPx = Math.max(12, fontPx * 0.9)
  }
  if (emojis && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${emojis}`.trim()
  }
  return { lines, fontPx: Math.round(fontPx) }
}

export function fitHeadlineBoldNewsForBox(
  formatted: string,
  boxWidthPx: number,
  boxHeightPx: number,
): { lines: string[]; fontPx: number } {
  return fitHeadlineDisplayForBox(formatted, boxWidthPx, boxHeightPx, { boldNews: true })
}

/** Fixed-scale preview when box metrics unknown (export dialog thumbnail). */
export function fitHeadlineDisplayLines(formatted: string): string[] {
  if (!formatted.trim()) return []
  let lines = wrapHeadlineDisplayLines(formatted, DEFAULT_CHARS_PER_LINE)
  if (lines.length >= 3) {
    const joined = lines.join(' ')
    lines = wrapHeadlineLinesFull(joined, 18, MAX_LINES)
  }
  return lines
}
