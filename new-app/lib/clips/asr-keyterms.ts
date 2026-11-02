import type { VocabEntry } from '@/lib/clips/clip-export-user-types'

const MAX_ASR_KEYTERMS = 50
const MAX_TERM_LEN = 60

/** Terms sent to Deepgram keyterm boosting (correct spellings from My vocabulary). */
export function vocabularyToAsrKeyterms(vocabulary: VocabEntry[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of vocabulary ?? []) {
    const term = String(row.to ?? row.from ?? '')
      .trim()
      .replace(/\s+/g, ' ')
    if (term.length < 2 || term.length > MAX_TERM_LEN) continue
    const key = term.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(term)
    if (out.length >= MAX_ASR_KEYTERMS) break
  }
  return out
}
