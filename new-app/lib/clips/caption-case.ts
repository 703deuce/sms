/** Sentence case: only sentence-initial words capitalized; others lowercased. */
export function formatCaptionWord(text: string, caseMode: string, sentenceStart: boolean): string {
  const safe = typeof text === 'string' ? text : ''
  if (!safe) return ''
  if (caseMode === 'upper') return safe.toUpperCase()
  const lower = safe.toLowerCase()
  return sentenceStart ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower
}

export function isSentenceBoundary(prevWord: string | undefined): boolean {
  if (!prevWord) return true
  return /[.!?]["')\]]*$/.test(prevWord.trim())
}

export function formatCaptionChunk(words: string[], caseMode: string): string {
  if (caseMode === 'upper') return words.map((w) => w.toUpperCase()).join(' ')
  let sentenceStart = true
  const parts: string[] = []
  for (const w of words) {
    parts.push(formatCaptionWord(w, 'sentence', sentenceStart))
    sentenceStart = isSentenceBoundary(w)
  }
  return parts.join(' ')
}
