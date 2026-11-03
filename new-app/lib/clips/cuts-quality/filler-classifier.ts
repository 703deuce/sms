/**
 * CUTS_QUALITY1 §2: default filler lexicon + exclusions (uh-huh, meaningful ah/oh).
 */
import { normalizeToken } from '@/lib/clips/script-editor/enrich-transcript'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

export const DEFAULT_FILLER_TOKENS = new Set(['um', 'uh', 'er', 'ah', 'hmm', 'erm'])

export const NON_FILLER_DEFAULT = new Set([
  'uhhuh',
  'uh-huh',
  'mmhmm',
  'mm-hmm',
  'yeah',
  'yep',
  'yes',
  'okay',
  'ok',
  'right',
])

function normPhrase(tokens: string[]): string {
  return tokens.map((t) => normalizeToken(t)).join('')
}

export function isNonFillerPhrase(text: string): boolean {
  const parts = text.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const p = normPhrase(parts)
    if (p === 'uhhuh' || p === 'mmhmm') return true
  }
  const t = normalizeToken(text)
  return NON_FILLER_DEFAULT.has(t)
}

/** Ah/Oh at start of a meaning-bearing clause (no pause > 150ms before next content). */
export function isMeaningfulLeadIn(word: EditorWord, next: EditorWord | undefined, deletedSet: Set<string>): boolean {
  const t = normalizeToken(word.text)
  if (t !== 'ah' && t !== 'oh') return false
  if (!next || deletedSet.has(next.id)) return false
  const gap = next.t0Ms - word.t1Ms
  if (gap > 150) return false
  const nextTok = normalizeToken(next.text)
  if (!nextTok || DEFAULT_FILLER_TOKENS.has(nextTok)) return false
  return true
}

export function isDefaultRemovableFiller(
  word: EditorWord,
  orderedWords: EditorWord[],
  index: number,
  deletedSet: Set<string>,
): boolean {
  if (isNonFillerPhrase(word.text)) return false
  const t = normalizeToken(word.text)
  if (!DEFAULT_FILLER_TOKENS.has(t)) return false
  const next = orderedWords[index + 1]
  if (isMeaningfulLeadIn(word, next, deletedSet)) return false
  return true
}
