import {
  buildSrtFromCaptionWords,
  displayPositionMs,
  formatSrtTime,
  normalizeEdits,
  type ClipBounds,
  type ClipEditsV2,
} from './edits'
import { formatCaptionChunk } from './caption-case'
import { buildCaptionWords, type CaptionSourceWord } from './caption-words'
import {
  captionLinesFromWords,
  captionLinesToSrt,
  captionLinesToVtt,
  type CaptionLine,
} from './editor/caption-lines'

/** Map edit-timeline ms → export/display ms for NLE subtitle cues (segment speeds + global speed). */
export function nleCaptionDisplayMs(edits: ClipEditsV2, editMs: number): number {
  return displayPositionMs(edits, editMs)
}

/** Match ASS: upper stays upper; anything else is sentence case with chunk-initial capitals. */
export function nleCaptionCaseMode(edits: ClipEditsV2): 'upper' | 'sentence' {
  return String(edits.captions?.case ?? '').toLowerCase() === 'upper' ? 'upper' : 'sentence'
}

export function applyNleCaptionCase(text: string, caseMode: 'upper' | 'sentence'): string {
  const parts = text.split(/\s+/).filter((w: string) => w.length > 0)
  if (!parts.length) return text
  return formatCaptionChunk(parts, caseMode)
}

function applyCaseToLines(lines: CaptionLine[], caseMode: 'upper' | 'sentence'): CaptionLine[] {
  return lines.map((l: CaptionLine) => ({
    ...l,
    text: applyNleCaptionCase(l.text, caseMode),
  }))
}

/**
 * Grouped caption cues on the export/display clock.
 * Manual captionLines keep user text; times are edit ms warped through displayPositionMs.
 * Word fixes are applied through buildCaptionWords when cues are derived from the transcript.
 * edits.captions.case is applied the same way as ASS (upper, or sentence with chunk-initial capitals).
 */
export function buildNleCaptionLines(
  words: CaptionSourceWord[],
  edits: unknown,
  bounds: ClipBounds,
): CaptionLine[] {
  const normalized = normalizeEdits(edits, bounds)
  const caseMode = nleCaptionCaseMode(normalized)
  if (normalized.captionLines?.length) {
    return applyCaseToLines(
      normalized.captionLines.map((l: CaptionLine) => ({
        ...l,
        startMs: nleCaptionDisplayMs(normalized, l.startMs),
        endMs: nleCaptionDisplayMs(normalized, l.endMs),
      })),
      caseMode,
    )
  }
  const captionWords = buildCaptionWords(words, normalized)
  const wpl = normalized.captions?.wordsPerLine ?? 2
  const grouped = applyCaseToLines(
    captionLinesFromWords(captionWords, wpl).map((l: CaptionLine) => ({
      ...l,
      startMs: nleCaptionDisplayMs(normalized, l.startMs),
      endMs: nleCaptionDisplayMs(normalized, l.endMs),
    })),
    caseMode,
  )
  if (grouped.length) return grouped
  return applyCaseToLines(
    captionWords.map((w: { i: number; text: string; s_ms: number; e_ms: number }, i: number) => ({
      id: `cw_${w.i}_${i}`,
      text: w.text,
      startMs: nleCaptionDisplayMs(normalized, w.s_ms),
      endMs: nleCaptionDisplayMs(normalized, w.e_ms),
    })),
    caseMode,
  )
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
  const lines = buildNleCaptionLines(words, edits, bounds)
  if (lines.length) return captionLinesToSrt(lines)
  const normalized = normalizeEdits(edits, bounds)
  const caseMode = nleCaptionCaseMode(normalized)
  const warped = buildCaptionWords(words, normalized).map((w: { text: string; s_ms: number; e_ms: number }) => ({
    text: applyNleCaptionCase(w.text, caseMode),
    s_ms: nleCaptionDisplayMs(normalized, w.s_ms),
    e_ms: nleCaptionDisplayMs(normalized, w.e_ms),
  }))
  return buildSrtFromCaptionWords(warped)
}

/** Same cues as SRT, formatted as WebVTT, still on the rendered/display clock. */
export function buildNleCaptionsVtt(
  words: CaptionSourceWord[],
  edits: unknown,
  bounds: ClipBounds,
): string {
  const lines = buildNleCaptionLines(words, edits, bounds)
  if (lines.length) return captionLinesToVtt(lines)
  return 'WEBVTT\n'
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
