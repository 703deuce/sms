import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export type WordSourceAdjust = { headTrimMs?: number; tailTrimMs?: number }

export function effectiveWordBounds(
  w: EditorWord,
  document: ScriptDocumentV1,
): { t0Ms: number; t1Ms: number } {
  const adj = document.wordSourceAdjust?.[w.id]
  const head = Math.max(0, adj?.headTrimMs ?? 0)
  const tail = Math.max(0, adj?.tailTrimMs ?? 0)
  const t0Ms = w.t0Ms + head
  const t1Ms = Math.max(t0Ms + 1, w.t1Ms - tail)
  return { t0Ms, t1Ms }
}

/** Symmetric silence trim between prev and word (spec §B3 shorten gaps). */
export function symmetricGapTrimMs(gapMs: number, targetGapMs: number): number {
  const remove = gapMs - targetGapMs
  if (remove <= 0) return 0
  return remove
}

export function applySymmetricGapTrim(
  document: ScriptDocumentV1,
  prevWordId: string,
  wordId: string,
  removeMs: number,
): ScriptDocumentV1 {
  if (removeMs <= 0) return document
  const half = Math.round(removeMs / 2)
  const rest = removeMs - half
  const adjust = { ...(document.wordSourceAdjust ?? {}) }
  const prev = { ...(adjust[prevWordId] ?? {}) }
  const curr = { ...(adjust[wordId] ?? {}) }
  prev.tailTrimMs = (prev.tailTrimMs ?? 0) + half
  curr.headTrimMs = (curr.headTrimMs ?? 0) + rest
  adjust[prevWordId] = prev
  adjust[wordId] = curr
  return { ...document, wordSourceAdjust: adjust }
}
