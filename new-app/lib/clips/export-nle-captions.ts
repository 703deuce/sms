import { buildSrtFromCaptionWords, displayPositionMs, normalizeEdits, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'
import { buildCaptionWords, type CaptionSourceWord } from '@/lib/clips/caption-words'
import { captionLinesFromWords, captionLinesToSrt } from '@/lib/clips/editor/caption-lines'

/** Grouped caption lines in export/display time for NLE zip captions.srt. */
export function buildNleCaptionsSrt(
  words: CaptionSourceWord[],
  edits: unknown,
  bounds: ClipBounds,
): string {
  const normalized = normalizeEdits(edits, bounds)
  if (normalized.captionLines?.length) {
    const lines = normalized.captionLines.map((l) => ({
      ...l,
      startMs: displayPositionMs(normalized, l.startMs),
      endMs: displayPositionMs(normalized, l.endMs),
    }))
    return captionLinesToSrt(lines)
  }
  const captionWords = buildCaptionWords(words, normalized)
  const wpl = normalized.captions?.wordsPerLine ?? 2
  const lines = captionLinesFromWords(captionWords, wpl).map((l) => ({
    ...l,
    startMs: displayPositionMs(normalized, l.startMs),
    endMs: displayPositionMs(normalized, l.endMs),
  }))
  if (lines.length) return captionLinesToSrt(lines)
  const warped = captionWords.map((w) => ({
    text: w.text,
    s_ms: displayPositionMs(normalized, w.s_ms),
    e_ms: displayPositionMs(normalized, w.e_ms),
  }))
  return buildSrtFromCaptionWords(warped)
}
