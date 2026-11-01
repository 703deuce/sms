export type SpeechWord = { w: string; s: number; e: number }

export type SpeechSource = {
  id: string
  kind: 'main' | 'upload' | 'take'
  label: string
  words: SpeechWord[]
}

export type SpeechSearchHit = {
  sourceId: string
  kind: SpeechSource['kind']
  label: string
  startS: number
  endS: number
  snippet: string
}

function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']/gu, '')
    .trim()
}

function queryTokens(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean)
}

function sourceTokens(words: SpeechWord[]): { token: string; index: number }[] {
  const out: { token: string; index: number }[] = []
  for (let i = 0; i < words.length; i++) {
    const t = normalizeToken(words[i]?.w ?? '')
    if (t) out.push({ token: t, index: i })
  }
  return out
}

function snippetFor(words: SpeechWord[], centerIndex: number, radius = 6): string {
  const lo = Math.max(0, centerIndex - radius)
  const hi = Math.min(words.length - 1, centerIndex + radius)
  const slice = words.slice(lo, hi + 1).map((w) => w.w)
  let text = slice.join(' ')
  if (lo > 0) text = `… ${text}`
  if (hi < words.length - 1) text = `${text} …`
  return text
}

export function searchSpeech(
  sources: SpeechSource[],
  q: string,
  opts?: { limit?: number },
): SpeechSearchHit[] {
  const parts = queryTokens(q)
  if (parts.length < 1) return []
  const limit = opts?.limit ?? 50
  const hits: SpeechSearchHit[] = []

  for (const source of sources) {
    const tokens = sourceTokens(source.words)
    if (tokens.length < parts.length) continue
    for (let i = 0; i <= tokens.length - parts.length; i++) {
      let ok = true
      for (let j = 0; j < parts.length; j++) {
        if (tokens[i + j]?.token !== parts[j]) {
          ok = false
          break
        }
      }
      if (!ok) continue
      const first = source.words[tokens[i]!.index]!
      const last = source.words[tokens[i + parts.length - 1]!.index]!
      hits.push({
        sourceId: source.id,
        kind: source.kind,
        label: source.label,
        startS: first.s,
        endS: last.e,
        snippet: snippetFor(source.words, tokens[i]!.index),
      })
    }
  }

  hits.sort((a, b) => {
    const ai = sources.findIndex((s) => s.id === a.sourceId)
    const bi = sources.findIndex((s) => s.id === b.sourceId)
    if (ai !== bi) return ai - bi
    return a.startS - b.startS
  })

  return hits.slice(0, limit)
}
