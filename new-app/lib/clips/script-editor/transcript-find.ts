import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

export type TranscriptFindOptions = {
  matchCase?: boolean
  matchWholeWords?: boolean
}

function normToken(s: string, matchCase: boolean) {
  const t = s.trim()
  return matchCase ? t : t.toLowerCase()
}

function wordText(w: EditorWord, overrides?: Record<string, string>) {
  return overrides?.[w.id] ?? w.text
}

export function transcriptFindHits(
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
  query: string,
  overrides: Record<string, string> | undefined,
  opts: TranscriptFindOptions,
): { word: EditorWord; index: number }[] {
  const q = query.trim()
  if (!q) return []
  const matchCase = Boolean(opts.matchCase)
  const whole = Boolean(opts.matchWholeWords)
  const needle = normToken(q, matchCase)
  const hits: { word: EditorWord; index: number }[] = []
  for (let i = 0; i < orderedWords.length; i++) {
    const w = orderedWords[i]
    if (deletedSet.has(w.id)) continue
    const raw = wordText(w, overrides)
    const hay = normToken(raw, matchCase)
    if (whole) {
      const tokens = hay.split(/\s+/).filter(Boolean)
      if (tokens.some((t) => t === needle || t.replace(/[^\w']/g, '') === needle.replace(/[^\w']/g, ''))) {
        hits.push({ word: w, index: i })
      }
    } else if (hay.includes(needle)) {
      hits.push({ word: w, index: i })
    }
  }
  return hits
}
