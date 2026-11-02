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

/** Map edit-timeline ms → export/display ms for NLE subtitle cues (segment speeds + global speed). */
export function nleCaptionDisplayMs(edits: ClipEditsV2, editMs: number): number {
  return displayPositionMs(edits, editMs)
}

/**
 * Build grouped caption lines in edit ms, then warp to export/display time.
 * Manual `captionLines` override burned caption text in renders but stay on the edit clock until
 * export post (worker `warp_srt`). NLE zip captions must use the same display clock as fcpxml /
 * premiere.xml — always from transcript words + displayPositionMs, not raw captionLines timestamps.
 */
export function buildNleCaptionsSrt(
  words: CaptionSourceWord[],
  edits: unknown,
  bounds: ClipBounds,
): string {
  const normalized = normalizeEdits(edits, bounds)
  const captionWords = buildCaptionWords(words, normalized)
  const wpl = normalized.captions?.wordsPerLine ?? 2
  const grouped = captionLinesFromWords(captionWords, wpl).map((l) => ({
    ...l,
    startMs: nleCaptionDisplayMs(normalized, l.startMs),
    endMs: nleCaptionDisplayMs(normalized, l.endMs),
  }))
  if (grouped.length) return captionLinesToSrt(grouped)
  const warped = captionWords.map((w) => ({
    text: w.text,
    s_ms: nleCaptionDisplayMs(normalized, w.s_ms),
    e_ms: nleCaptionDisplayMs(normalized, w.e_ms),
  }))
  return buildSrtFromCaptionWords(warped)
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
