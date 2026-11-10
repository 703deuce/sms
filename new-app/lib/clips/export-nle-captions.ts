import {
  buildSrtFromCaptionWords,
  displayPositionMs,
  formatSrtTime,
  normalizeEdits,
  type ClipBounds,
  type ClipEditsV2,
} from '@/lib/clips/edits'
import { buildCaptionWords, type CaptionSourceWord } from '@/lib/clips/caption-words'
import { captionLinesFromWords, captionLinesToSrt } from '@/lib/clips/editor/caption-lines'
import { formatCaptionLineText, formatCaptionWord, isSentenceBoundary } from './caption-case'


function srtCaseMode(edits: ClipEditsV2): 'upper' | 'sentence' {
  return edits.captions?.case === 'upper' ? 'upper' : 'sentence'
}

function applyCaptionCaseToLines<T extends { text: string }>(lines: T[], caseMode: string): T[] {
  return lines.map((line) => ({ ...line, text: formatCaptionLineText(line.text, caseMode) }))
}

function applyCaptionCaseToWords<T extends { text: string }>(words: T[], caseMode: string): T[] {
  let sentenceStart = true
  return words.map((word) => {
    const text = formatCaptionWord(word.text, caseMode, sentenceStart)
    sentenceStart = isSentenceBoundary(word.text)
    return { ...word, text }
  })
}

/** Map edit-timeline ms → export/display ms for NLE subtitle cues (segment speeds + global speed). */
export function nleCaptionDisplayMs(edits: ClipEditsV2, editMs: number): number {
  return displayPositionMs(edits, editMs)
}

/**
 * Build grouped caption lines for NLE zip captions.srt (export/display clock).
 * Manual captionLines keep user text; times are edit ms warped through displayPositionMs.
 */
export function buildNleCaptionsSrt(
  words: CaptionSourceWord[],
  edits: unknown,
  bounds: ClipBounds,
): string {
  const normalized = normalizeEdits(edits, bounds)
  if (normalized.captionLines?.length) {
    const lines = normalized.captionLines.map((l) => ({
      ...l,
      startMs: nleCaptionDisplayMs(normalized, l.startMs),
      endMs: nleCaptionDisplayMs(normalized, l.endMs),
    }))
    return captionLinesToSrt(applyCaptionCaseToLines(lines, srtCaseMode(normalized)))
  }
  const captionWords = buildCaptionWords(words, normalized)
  const wpl = normalized.captions?.wordsPerLine ?? 2
  const grouped = captionLinesFromWords(captionWords, wpl).map((l) => ({
    ...l,
    startMs: nleCaptionDisplayMs(normalized, l.startMs),
    endMs: nleCaptionDisplayMs(normalized, l.endMs),
  }))
  if (grouped.length) return captionLinesToSrt(applyCaptionCaseToLines(grouped, srtCaseMode(normalized)))
  const warped = captionWords.map((w) => ({
    text: w.text,
    s_ms: nleCaptionDisplayMs(normalized, w.s_ms),
    e_ms: nleCaptionDisplayMs(normalized, w.e_ms),
  }))
  return buildSrtFromCaptionWords(applyCaptionCaseToWords(warped, srtCaseMode(normalized)))
}

/** Same caption cues as SRT, serialized as WebVTT on the rendered/display clock. */
export function buildNleCaptionsVtt(
  words: CaptionSourceWord[],
  edits: unknown,
  bounds: ClipBounds,
): string {
  console.info('[captions:vtt] build_begin', { words: words.length })
  const srt = buildNleCaptionsSrt(words, edits, bounds).trim()
  if (!srt) {
    console.info('[captions:vtt] build_complete', { cues: 0 })
    return 'WEBVTT\n'
  }
  const vttBody = srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  const cues = (vttBody.match(/-->/g) ?? []).length
  console.info('[captions:vtt] build_complete', { cues })
  return `WEBVTT\n\n${vttBody}\n`
}

/** Parse SRT cue times (ms) and rewrite through `displayPositionMs` (for tests / parity checks). */
export function warpSrtCuesToDisplayMs(srt: string, edits: ClipEditsV2): string {
  const lines = srt.split('\n')
  const timeRe = /^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})$/
  const parse = (ts: string) => {
    const m = ts.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/)
    if (!m) return 0
    return (
      ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4])
    )
  }
  const out: string[] = []
  for (const line of lines) {
    const m = line.match(timeRe)
    if (!m) {
      out.push(line)
      continue
    }
    const a = nleCaptionDisplayMs(edits, parse(m[1]!))
    const b = nleCaptionDisplayMs(edits, parse(m[2]!))
    out.push(`${formatSrtTime(a / 1000)} --> ${formatSrtTime(b / 1000)}`)
  }
  return out.join('\n')
}
