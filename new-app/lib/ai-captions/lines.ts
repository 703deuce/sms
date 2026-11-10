import { isSentenceBoundary } from '@/lib/clips/caption-case'
import {
  CAPTION_LINE_MAX_CHARS,
  CAPTION_LINE_MIN_MS,
  normalizeCaptionLines,
  splitTokensByMaxChars,
  lineTokens,
  serializeTokens,
  type CaptionLine,
} from '@/lib/clips/editor/caption-lines'
import type { AiCaptionsLine, AiCaptionsWord } from '@/lib/ai-captions/types'

const DISPLAY_MAX_CHARS = 42
const DISPLAY_MAX_WORDS = 12
const PAUSE_MS = 700

function charLen(words: AiCaptionsWord[]): number {
  return words.map((w) => w.text).join(' ').length
}

/**
 * Sentence-aware grouping. Do not split right after a mid-sentence word when the line still fits.
 * Oversized cues split on word boundaries only (#1132 / splitTokensByMaxChars) and never drop words.
 */
export function groupCaptionLines(words: AiCaptionsWord[]): AiCaptionsLine[] {
  const groups: AiCaptionsWord[][] = []
  let current: AiCaptionsWord[] = []

  const flush = () => {
    if (!current.length) return
    groups.push(current)
    current = []
  }

  for (const word of words) {
    if (!current.length) {
      current = [word]
      continue
    }
    const prev = current[current.length - 1]!
    const nextChars = charLen([...current, word])
    const startNew =
      isSentenceBoundary(prev.text) ||
      word.startMs - prev.endMs >= PAUSE_MS ||
      current.length >= DISPLAY_MAX_WORDS ||
      nextChars > DISPLAY_MAX_CHARS
    if (startNew) flush()
    current.push(word)
  }
  flush()

  const lines: CaptionLine[] = []
  for (const group of groups) {
    for (const piece of splitGroupOnWordBoundaries(group)) {
      const startMs = piece[0]!.startMs
      let endMs = piece[piece.length - 1]!.endMs
      endMs = Math.max(endMs, startMs + CAPTION_LINE_MIN_MS)
      const text = piece.map((w) => w.text).join(' ')
      lines.push({ id: `cl${lines.length}_${startMs}`, text, startMs, endMs })
    }
  }

  return (normalizeCaptionLines(lines) as AiCaptionsLine[]).map((line, i) => ({
    id: line.id || `cl${i}_${line.startMs}`,
    text: line.text,
    startMs: line.startMs,
    endMs: line.endMs,
  }))
}

function splitGroupOnWordBoundaries(group: AiCaptionsWord[]): AiCaptionsWord[][] {
  if (!group.length) return []
  const text = group.map((w) => w.text).join(' ')
  const tokens = lineTokens(text)
  const maxChars = Math.min(DISPLAY_MAX_CHARS, CAPTION_LINE_MAX_CHARS)
  if (text.length <= maxChars) return [group]
  const chunks = splitTokensByMaxChars(tokens, maxChars)
  if (chunks.length <= 1) return [group]

  const out: AiCaptionsWord[][] = []
  let offset = 0
  for (const chunk of chunks) {
    const chunkText = serializeTokens(chunk)
    const n = chunkText.split(/\s+/).filter(Boolean).length
    const slice = group.slice(offset, offset + n)
    offset += n
    if (slice.length) out.push(slice)
  }
  if (offset < group.length) {
    const rest = group.slice(offset)
    if (out.length) out[out.length - 1] = [...out[out.length - 1]!, ...rest]
    else out.push(rest)
  }
  return out.length ? out : [group]
}
