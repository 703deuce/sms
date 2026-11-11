/**
 * Deterministic motion-title fitting for the existing TextItem contract.
 * The adapter stores the chosen font size and explicit line breaks, so browser
 * preview and ASS/FFmpeg export consume the same text instead of independently
 * wrapping it.
 */
import { textWidthPx } from '@/lib/clips/caption-fit'

export type MotionTextFormat = '9:16' | '16:9' | '1:1'

const REF_H = 1920

export type MotionTextFit = {
  fits: boolean
  text: string
  size: number
  lineCount: number
  maxLineWidthPx: number
  blockHeightPx: number
  boxWidthPx: number
  boxHeightPx: number
}

export function motionReferenceWidth(format: MotionTextFormat): number {
  if (format === '9:16') return REF_H * 9 / 16
  if (format === '16:9') return REF_H * 16 / 9
  return REF_H
}

export function estimateMotionTextLineWidth(text: string, size: number, fontFamily: string): number {
  return textWidthPx(text, fontFamily, size)
}

function wrapParagraph(paragraph: string, size: number, maxWidth: number, fontFamily: string): string[] {
  if (!paragraph) return ['']
  const lines: string[] = []
  let current = ''
  for (const ch of Array.from(paragraph)) {
    const candidate = current + ch
    if (!current || estimateMotionTextLineWidth(candidate, size, fontFamily) <= maxWidth) {
      current = candidate
      continue
    }

    // Prefer replacing an existing whitespace boundary with the line break.
    const breakAt = Math.max(current.lastIndexOf(' '), current.lastIndexOf('\t'))
    if (breakAt >= 0) {
      const before = current.slice(0, breakAt)
      const after = current.slice(breakAt + 1)
      if (before) lines.push(before)
      current = after + ch
      continue
    }

    // A long URL/token still wraps instead of being clipped; no source glyph is removed.
    lines.push(current)
    current = ch
  }
  lines.push(current)
  return lines
}

function wrapText(text: string, size: number, maxWidth: number, fontFamily: string): string[] {
  return text.split('\n').flatMap((paragraph) => wrapParagraph(paragraph, size, maxWidth, fontFamily))
}

/**
 * Fits text inside the plan box at a 1920px-tall reference canvas. Because all
 * TextItem sizes scale from the same 1920 reference, a fit remains identical at
 * 720p and 1080p for the same aspect ratio.
 */
export function fitMotionTextToBox(input: {
  text: string
  fontFamily: string
  format: MotionTextFormat
  box: { width: number; height: number }
  preferredSize: number
  minSize?: number
  maxSize?: number
  edgeInsetPx?: number
}): MotionTextFit {
  const minSize = Math.max(24, Math.round(input.minSize ?? 24))
  const maxSize = Math.max(minSize, Math.min(240, Math.round(input.maxSize ?? 240)))
  const preferred = Math.max(minSize, Math.min(maxSize, Math.round(input.preferredSize)))
  const inset = Math.max(0, input.edgeInsetPx ?? 12)
  const boxWidthPx = Math.max(1, input.box.width * motionReferenceWidth(input.format))
  const boxHeightPx = Math.max(1, input.box.height * REF_H)
  const availableWidth = Math.max(1, boxWidthPx - inset * 2)
  const availableHeight = Math.max(1, boxHeightPx - inset * 2)

  let last: MotionTextFit | null = null
  for (let size = preferred; size >= minSize; size--) {
    const lines = wrapText(input.text, size, availableWidth, input.fontFamily)
    const maxLineWidthPx = Math.max(0, ...lines.map((line) => estimateMotionTextLineWidth(line, size, input.fontFamily)))
    const blockHeightPx = Math.max(size, lines.length * size)
    const fit: MotionTextFit = {
      fits: maxLineWidthPx <= availableWidth + 0.5 && blockHeightPx <= availableHeight + 0.5,
      text: lines.join('\n'),
      size,
      lineCount: lines.length,
      maxLineWidthPx,
      blockHeightPx,
      boxWidthPx,
      boxHeightPx,
    }
    if (fit.fits) return fit
    last = fit
  }
  return last ?? {
    fits: false,
    text: input.text,
    size: minSize,
    lineCount: input.text.split('\n').length,
    maxLineWidthPx: estimateMotionTextLineWidth(input.text, minSize, input.fontFamily),
    blockHeightPx: minSize,
    boxWidthPx,
    boxHeightPx,
  }
}
