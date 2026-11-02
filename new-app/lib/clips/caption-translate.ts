import { buildCaptionWords } from '@/lib/clips/caption-words'
import { DUB_LANGUAGES } from '@/lib/clips/dub'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { captionLinesFromWords, type CaptionLine } from '@/lib/clips/editor/caption-lines'
import type { SourceWord } from '@/lib/clips/source-words'

/** TX-26: editable translated caption tracks (expanded Q4 language set). */
export const TRANSLATE_CAPTION_LANGUAGES = DUB_LANGUAGES

export type CaptionTranslateChunk = { startMs: number; endMs: number; text: string }

export function chunksForTranslation(edits: ClipEditsV2, words: SourceWord[]): CaptionTranslateChunk[] {
  if (edits.captionLines?.length) {
    return edits.captionLines.map((l) => ({ startMs: l.startMs, endMs: l.endMs, text: l.text }))
  }
  const capWords = buildCaptionWords(
    words.map((w) => ({ i: w.i, w: w.w, s: w.s, e: w.e, spk: w.spk })),
    edits,
  )
  const wpl = edits.captions?.wordsPerLine ?? 2
  const lines = captionLinesFromWords(
    capWords.map((c) => ({ text: c.text, s_ms: c.s_ms, e_ms: c.e_ms })),
    wpl,
  )
  return lines.map((l) => ({ startMs: l.startMs, endMs: l.endMs, text: l.text }))
}

export function linesFromTranslation(chunks: CaptionTranslateChunk[], texts: string[]): CaptionLine[] {
  return chunks.map((chunk, i) => {
    const translated = (texts[i] ?? '').trim()
    const text = translated || chunk.text
    return {
      id: `tr_${chunk.startMs}_${i}`,
      startMs: chunk.startMs,
      endMs: chunk.endMs,
      text: text.slice(0, 200),
    }
  })
}
