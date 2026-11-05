import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { keepSegments, wordDisplayText } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'

export type FindMatch = { wordIdx: number[]; startMs: number; endMs: number }

function normalizeToken(s: string): string {
  return s.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')
}

function searchableWords(words: SourceWord[], edits: ClipEditsV2) {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  const out: { i: number; text: string; norm: string; startMs: number; endMs: number }[] = []
  for (const w of words) {
    const { startMs, endMs, midMs } = wordSourceMs(w)
    if (!segs.some(([a, b]) => midMs >= a && midMs < b)) continue
    const key = String(w.i)
    if (key in edits.wordFixes && edits.wordFixes[key] === '') continue
    const display = wordDisplayText(w as ClipWord, edits.wordFixes)
    const norm = normalizeToken(display)
    if (!norm && key in edits.wordFixes) continue
    out.push({ i: w.i, text: display, norm, startMs, endMs })
  }
  return out
}

export function findMatches(
  words: SourceWord[],
  edits: ClipEditsV2,
  query: string,
  opts?: { wholeWord?: boolean; caseSensitive?: boolean },
): FindMatch[] {
  const q = query.trim()
  if (!q) return []
  const caseSensitive = opts?.caseSensitive === true
  const wholeWord = opts?.wholeWord !== false
  const queryParts = q
    .split(/\s+/)
    .map((p) => normalizeToken(p))
    .filter(Boolean)
    .map((p) => (caseSensitive ? p : p.toLowerCase()))
  if (!queryParts.length) return []

  const tokens = searchableWords(words, edits)
  const normTok = (t: string) => {
    const n = normalizeToken(t)
    return caseSensitive ? n : n.toLowerCase()
  }
  const matches: FindMatch[] = []

  if (queryParts.length === 1 && !wholeWord) {
    const needle = queryParts[0]!
    for (const t of tokens) {
      const nt = normTok(t.text)
      if (nt.includes(needle)) {
        matches.push({ wordIdx: [t.i], startMs: t.startMs, endMs: t.endMs })
      }
    }
    return matches
  }

  for (let start = 0; start <= tokens.length - queryParts.length; start++) {
    let ok = true
    for (let j = 0; j < queryParts.length; j++) {
      const nt = tokens[start + j]?.norm ?? ''
      const cmp = caseSensitive ? nt : nt.toLowerCase()
      if (wholeWord ? cmp !== queryParts[j] : !cmp.includes(queryParts[j]!)) {
        ok = false
        break
      }
    }
    if (!ok) continue
    const slice = tokens.slice(start, start + queryParts.length)
    matches.push({
      wordIdx: slice.map((t) => t.i),
      startMs: slice[0]!.startMs,
      endMs: slice[slice.length - 1]!.endMs,
    })
  }
  return matches
}

function trailingPunct(s: string): string {
  const m = s.match(/[^\p{L}\p{N}']+$/u)
  return m ? m[0] : ''
}

export function replacementFixes(
  words: SourceWord[],
  match: FindMatch,
  replacement: string,
): { fixes: Record<string, string>; meta: Record<string, { s: number; w: string }> } {
  const fixes: Record<string, string> = {}
  const meta: Record<string, { s: number; w: string }> = {}
  const repTokens = replacement.trim().split(/\s+/).filter(Boolean)
  const matched = match.wordIdx.map((idx) => words.find((w) => w.i === idx)).filter(Boolean) as SourceWord[]

  if (repTokens.length === matched.length) {
    for (let i = 0; i < matched.length; i++) {
      const w = matched[i]!
      const key = String(w.i)
      // Preserve sentence delimiters on the replaced source word so paragraph
      // grouping does not merge this line with the next one.
      const punctuation = trailingPunct(w.w)
      fixes[key] = repTokens[i]! + (punctuation && !repTokens[i]!.endsWith(punctuation) ? punctuation : '')
      meta[key] = { s: Math.round(w.s * 1000), w: w.w }
    }
    return { fixes, meta }
  }

  const last = matched[matched.length - 1]
  const punct = last ? trailingPunct(last.w) : ''
  const first = matched[0]
  if (first) {
    const key = String(first.i)
    fixes[key] = (repTokens[0] ?? replacement.trim()) + punct
    meta[key] = { s: Math.round(first.s * 1000), w: first.w }
  }
  for (let i = 1; i < matched.length; i++) {
    const w = matched[i]!
    const key = String(w.i)
    fixes[key] = ''
    meta[key] = { s: Math.round(w.s * 1000), w: w.w }
  }
  return { fixes, meta }
}
