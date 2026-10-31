import type { CaptionSourceWord } from '@/lib/clips/caption-words'
import { buildCaptionWords, captionWordsToClipWords } from '@/lib/clips/caption-words'
import { captionLineClipWords } from '@/lib/clips/editor/caption-lines'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { normalizeSectionOrder, outputDurationMs } from '@/lib/clips/edits'
import { logEditorDecision } from '@/lib/clips/editor-decision-log'
import { applyLoopFriendlyTrimToEdits } from '@/lib/clips/loop-friendly-trim'
import { applySilenceTrimToEdits } from '@/lib/clips/silence-trim'

function toClipWords(words: CaptionSourceWord[]): ClipWord[] {
  return words.map((w) => ({ w: w.w, s: w.s, e: w.e, i: w.i, idx: w.i }))
}

/** Preview + export-length parity: silence trim + optional loop-friendly end (preview only). */
export function editorPreviewEdits(edits: ClipEditsV2, words: CaptionSourceWord[]): ClipEditsV2 {
  let next = edits
  if (edits.silenceTrim?.enabled && words.length) {
    next = applySilenceTrimToEdits(next, toClipWords(words), { ...edits.silenceTrim, enabled: true })
  }
  if (words.length && next.loopFriendlyEnd !== false) {
    if (normalizeSectionOrder(next.sectionOrder, next.trim.in, next.trim.out)) {
      logEditorDecision('loop_trim_skipped', { reason: 'reorder' })
    } else {
      next = applyLoopFriendlyTrimToEdits(next, words, {})
    }
  }
  return next
}

export function editorPreviewDurationMs(edits: ClipEditsV2, words: CaptionSourceWord[]): number {
  return outputDurationMs(editorPreviewEdits(edits, words))
}

/** Same caption word pipeline as export burn-in (output timeline seconds). */
export function editorPreviewCaptionClipWords(
  words: CaptionSourceWord[],
  edits: ClipEditsV2,
): ReturnType<typeof captionWordsToClipWords> {
  const previewEdits = editorPreviewEdits(edits, words)
  // G3a: manual caption lines replace the transcript words in the captions (export: edits_render).
  if (previewEdits.captionLines?.length) return captionLineClipWords(previewEdits.captionLines)
  return captionWordsToClipWords(buildCaptionWords(words, previewEdits))
}
