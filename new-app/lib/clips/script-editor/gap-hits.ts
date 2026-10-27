import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { effectiveWordBounds } from '@/lib/clips/script-edl/word-adjust'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export type GapFilterMode = 'more_than' | 'between'

export type GapHit = {
  word: EditorWord
  prevWord: EditorWord
  index: number
  gapMs: number
}

export function gapMsBetween(prev: EditorWord, word: EditorWord, document?: ScriptDocumentV1): number {
  if (document) {
    const p = effectiveWordBounds(prev, document)
    const w = effectiveWordBounds(word, document)
    return Math.max(0, w.t0Ms - p.t1Ms)
  }
  return Math.max(0, word.t0Ms - prev.t1Ms)
}

export function listGapHits(
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
  opts: {
    mode: GapFilterMode
    minGapMs: number
    maxGapMs?: number
    selectionOnly?: boolean
    selectedIds?: Set<string>
    document?: ScriptDocumentV1
  },
): GapHit[] {
  const hits: GapHit[] = []
  for (let i = 1; i < orderedWords.length; i++) {
    const prev = orderedWords[i - 1]
    const w = orderedWords[i]
    if (deletedSet.has(w.id) || deletedSet.has(prev.id)) continue
    const gap = gapMsBetween(prev, w, opts.document)
    let match = false
    if (opts.mode === 'more_than') match = gap >= opts.minGapMs
    else {
      const hi = opts.maxGapMs ?? opts.minGapMs
      match = gap >= opts.minGapMs && gap <= hi
    }
    if (!match) continue
    if (opts.selectionOnly && opts.selectedIds && !opts.selectedIds.has(w.id) && !opts.selectedIds.has(prev.id)) {
      continue
    }
    hits.push({ word: w, prevWord: prev, index: i, gapMs: gap })
  }
  return hits
}
