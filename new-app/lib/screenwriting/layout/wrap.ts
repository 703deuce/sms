import type { FormatSpec, ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { cellWidthForElement } from '@/lib/screenwriting/formats/types'
import type { WrappedLine } from '@/lib/screenwriting/layout/types'

const TAB_WIDTH = 4

/** East Asian Wide + emoji heuristic (Unicode categories simplified). */
function charCellWidth(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0
  if (cp >= 0x1f300 && cp <= 0x1faff) return 2
  if (cp >= 0x1100 && cp <= 0x115f) return 2
  if (cp >= 0x2e80 && cp <= 0xa4cf) return 2
  if (cp >= 0xac00 && cp <= 0xd7a3) return 2
  if (cp >= 0xf900 && cp <= 0xfaff) return 2
  if (cp >= 0xfe10 && cp <= 0xfe19) return 2
  if (cp >= 0xfe30 && cp <= 0xfe6f) return 2
  if (cp >= 0xff00 && cp <= 0xff60) return 2
  if (cp >= 0xffe0 && cp <= 0xffe6) return 2
  return 1
}

function displayText(raw: string, caps: boolean): string {
  return caps ? raw.toUpperCase() : raw
}

function expandTabs(line: string): string {
  const parts = line.split('\t')
  let out = parts[0] ?? ''
  for (let i = 1; i < parts.length; i++) {
    const pad = TAB_WIDTH - (out.length % TAB_WIDTH)
    out += ' '.repeat(pad === TAB_WIDTH ? 0 : pad) + parts[i]
  }
  return out
}

function lineCellLength(line: string): number {
  let n = 0
  for (const ch of line) n += charCellWidth(ch)
  return n
}

function breakWord(word: string, width: number): string[] {
  const chunks: string[] = []
  let cur = ''
  let len = 0
  for (const ch of word) {
    const w = charCellWidth(ch)
    if (len + w > width && cur) {
      chunks.push(cur)
      cur = ch
      len = w
    } else {
      cur += ch
      len += w
    }
  }
  if (cur) chunks.push(cur)
  return chunks.length ? chunks : ['']
}

function wrapSingleLine(line: string, width: number): string[] {
  const expanded = expandTabs(line)
  if (lineCellLength(expanded) <= width) return [expanded]

  const out: string[] = []
  let segment = ''
  let segLen = 0
  const tokens = expanded.split(/(\s+)/)
  for (const tok of tokens) {
    if (!tok) continue
    const tokLen = lineCellLength(tok)
    if (tokLen > width) {
      if (segment) {
        out.push(segment)
        segment = ''
        segLen = 0
      }
      const parts = breakWord(tok, width)
      for (let i = 0; i < parts.length; i++) {
        if (i < parts.length - 1) out.push(parts[i])
        else {
          segment = parts[i]
          segLen = lineCellLength(segment)
        }
      }
      continue
    }
    if (segLen + tokLen > width && segment) {
      out.push(segment.replace(/\s+$/, ''))
      segment = tok.trimStart()
      segLen = lineCellLength(segment)
    } else {
      segment += tok
      segLen = lineCellLength(segment)
    }
  }
  if (segment) out.push(segment)
  return out.length ? out : ['']
}

export function wrapText(
  raw: string,
  type: ScreenplayElementType,
  spec: FormatSpec,
  caps = false,
  hardBreaks: number[] = [],
): WrappedLine[] {
  const width = cellWidthForElement(spec, type)
  const text = displayText(raw, caps)
  if (!text) return [{ text: '', offset: 0 }]

  const breaks = [...hardBreaks].sort((a, b) => a - b)
  const segments: { start: number; slice: string }[] = []
  let last = 0
  for (const br of breaks) {
    if (br > last && br <= text.length) {
      segments.push({ start: last, slice: text.slice(last, br) })
      last = br
    }
  }
  segments.push({ start: last, slice: text.slice(last) })

  const wrapped: WrappedLine[] = []
  for (const seg of segments) {
    const physical = seg.slice.split('\n')
    for (let pi = 0; pi < physical.length; pi++) {
      const piece = physical[pi]
      const lines = wrapSingleLine(piece, width)
      let localOff = 0
      for (const ln of lines) {
        wrapped.push({ text: ln, offset: seg.start + localOff })
        localOff += ln.length
      }
      if (pi < physical.length - 1) {
        wrapped.push({ text: '', offset: seg.start + localOff })
      }
    }
  }
  return wrapped.length ? wrapped : [{ text: '', offset: 0 }]
}

export function wrapCacheKey(type: ScreenplayElementType, text: string, specKey: string, caps: boolean): string {
  return `${specKey}:${type}:${caps ? 1 : 0}:${text}`
}
