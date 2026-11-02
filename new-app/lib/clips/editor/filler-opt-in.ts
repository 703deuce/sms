import { OPT_IN_FILLER_WORDS } from '@/lib/clips/editor/cleanup-strength'
import { normalizeToken } from '@/lib/clips/script-editor/enrich-transcript'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

export function optInPhraseAt(
  orderedWords: EditorWord[],
  startIndex: number,
  deletedSet: Set<string>,
  enabledOptIn: ReadonlySet<string>,
): { phrase: string; endIndex: number } | null {
  for (const phrase of OPT_IN_FILLER_WORDS) {
    if (!enabledOptIn.has(phrase)) continue
    const parts = phrase.split(/\s+/).filter(Boolean)
    if (parts.length < 2) continue
    let ok = true
    for (let k = 0; k < parts.length; k++) {
      const w = orderedWords[startIndex + k]
      if (!w || deletedSet.has(w.id) || normalizeToken(w.text) !== parts[k]) {
        ok = false
        break
      }
    }
    if (ok) return { phrase, endIndex: startIndex + parts.length - 1 }
  }
  return null
}

export function wordEligibleForOptInSingle(
  wordText: string,
  enabledOptIn: ReadonlySet<string>,
): boolean {
  const t = normalizeToken(wordText)
  for (const phrase of OPT_IN_FILLER_WORDS) {
    if (!enabledOptIn.has(phrase)) continue
    if (phrase.split(/\s+/).length === 1 && t === phrase) return true
  }
  return false
}
