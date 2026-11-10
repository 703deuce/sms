/** Sentence case: capitalize the first letter of each cue or sentence; keep source casing everywhere else. */
export function formatCaptionWord(text: string, caseMode: string, sentenceStart: boolean): string {
  const safe = typeof text === 'string' ? text : ''
  if (!safe) return ''
  if (caseMode === 'upper') return safe.toUpperCase()
  if (!sentenceStart) return safe
  return safe.charAt(0).toUpperCase() + safe.slice(1)
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

/** Apply the same case transform as formatCaptionChunk, preserving newlines and spacing. */
export function formatCaptionLineText(text: string, caseMode: string): string {
  const safe = typeof text === 'string' ? text : ''
  if (!safe) return ''
  if (caseMode === 'upper') {
    return safe.replace(/[^\s]+/g, (word) => word.toUpperCase())
  }
  const parts = safe.split(/(\s+)/)
  let sentenceStart = true
  return parts
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part
      const formatted = formatCaptionWord(part, 'sentence', sentenceStart)
      sentenceStart = isSentenceBoundary(part)
      return formatted
    })
    .join('')
}
