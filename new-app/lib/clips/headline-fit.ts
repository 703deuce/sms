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
  return Math.max(MIN_CHARS_PER_LINE, Math.floor((boxWidthPx * 0.92) / charW))
}

/** Fit headline into box: shrink font / tighten wrap before ellipsis on the last line only. */
export function fitHeadlineDisplayForBox(
  formatted: string,
  boxWidthPx: number,
  boxHeightPx: number,
): { lines: string[]; fontPx: number } {
  const trimmed = formatted.trim()
  if (!trimmed || boxWidthPx <= 0 || boxHeightPx <= 0) {
    return { lines: [], fontPx: 12 }
  }
  const emojiTail = (trimmed.match(/(\p{Extended_Pictographic}+)$/u) || [])[0] || ''
  const body = trimmed.slice(0, trimmed.length - emojiTail.length).trim()
  const emojis = [...emojiTail].slice(0, 2).join('')

  let fontPx = Math.max(
    10,
    Math.min((boxHeightPx * 0.52) / 3, boxHeightPx * 0.45),
  )
  let lines: string[] = []
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const cpl = headlineCharsPerLineForBox(boxWidthPx, fontPx)
    lines = wrapHeadlineLinesFull(body, cpl, MAX_LINES)
    const longest = Math.max(0, ...lines.map((l) => l.length))
    if (longest <= cpl + 1 || fontPx <= 11) break
    fontPx = Math.max(10, fontPx * 0.88)
  }
  const cplFinal = headlineCharsPerLineForBox(boxWidthPx, fontPx)
  lines = lines.map((l, i) =>
    i === lines.length - 1 ? ellipsizeLine(l, cplFinal + 2) : ellipsizeLine(l, cplFinal + 1),
  )
  if (emojis && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1]} ${emojis}`.trim()
  }
  return { lines, fontPx }
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
