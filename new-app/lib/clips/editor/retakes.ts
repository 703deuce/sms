import type { CutRange } from '@/lib/clips/edits'

export type RetakeWord = { w: string; s: number; e: number }

export type RetakeAttempt = { startMs: number; endMs: number; text: string }

export type RetakeGroup = { attempts: RetakeAttempt[]; keepIndex: number }

const SENTENCE_END = /[.!?]["']?$/
const MAX_RETAKE_WINDOW_MS = 4500
const MAX_RETAKE_CUT_MS = 4000
const MIN_RETAKE_CUT_MS = 250
const MAX_RETAKE_GROUPS = 6

const FILLER = new Set(['um', 'uh', 'er', 'ah', 'hmm', 'mm'])

/** Tokens too weak to anchor a phrase repeat on their own. */
const WEAK = new Set([
  'you',
  'know',
  'it',
  'its',
  "it's",
  'just',
  'we',
  'this',
  'that',
  'gonna',
  'see',
  'how',
  'is',
  'are',
  'was',
  'were',
  'have',
  'has',
  'got',
  'and',
  'or',
  'but',
  'so',
  'with',
  'for',
  'the',
  'a',
  'an',
  'i',
  'my',
  'our',
  'your',
  'they',
  'their',
  'to',
  'of',
  'in',
  'on',
  'at',
  'as',
  'be',
  'do',
  'did',
  'will',
  'would',
  'can',
  'could',
  'man',
  'well',
  'yeah',
  'yes',
  'no',
  'okay',
  'ok',
  'right',
])

const TRUNC_END = /(\.\.\.|…|—)$/
const TRUNC_WORD = /(\.\.\.|…|—|-)$/
const HARD_PUNCT = /[.!?,;:]$/

function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']/gu, '')
    .trim()
}

function msFromS(s: number): number {
  return Math.round(s * 1000)
}

function gapMs(a: RetakeWord, b: RetakeWord): number {
  return Math.max(0, b.s * 1000 - a.e * 1000)
}

type StreamTok = { t: string; wi: number; wf: number }

function buildTokenStream(words: RetakeWord[]): StreamTok[] {
  const toks: StreamTok[] = []
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi]!
    const t = normalizeToken(w.w)
    if (!t || FILLER.has(t)) continue
    const prev = toks[toks.length - 1]
    if (
      prev &&
      prev.t === t &&
      gapMs(words[prev.wi]!, w) < 500 &&
      !SENTENCE_END.test(words[prev.wi]!.w.trim())
    ) {
      toks[toks.length - 1] = { t, wi, wf: prev.wf }
      continue
    }
    toks.push({ t, wi, wf: wi })
  }
  return toks
}

function textSlice(words: RetakeWord[], fromWi: number, toWiExclusive: number): string {
  return words
    .slice(fromWi, Math.min(words.length, toWiExclusive))
    .map((w) => w.w)
    .join(' ')
}

function keptEndWi(words: RetakeWord[], toks: StreamTok[], fromTok: number, spanToks: number): number {
  const lastTok = toks[fromTok + spanToks - 1]
  if (!lastTok) return fromTok
  return Math.min(words.length, lastTok.wi + 1)
}

function abandonHasHardPunct(words: RetakeWord[], fromWi: number, toWiExclusive: number): boolean {
  for (let i = fromWi; i < toWiExclusive && i < words.length; i++) {
    const raw = words[i]!.w.trim()
    if (FILLER.has(normalizeToken(raw))) continue
    if (HARD_PUNCT.test(raw) && !TRUNC_WORD.test(raw)) return true
  }
  return false
}

function candidateToGroup(
  words: RetakeWord[],
  abandonStartMs: number,
  keepStartMs: number,
  keepEndWi: number,
): RetakeGroup | null {
  if (keepStartMs <= abandonStartMs) return null
  const cutMs = keepStartMs - abandonStartMs
  if (cutMs < MIN_RETAKE_CUT_MS || cutMs > MAX_RETAKE_CUT_MS) return null
  if (keepStartMs - abandonStartMs > MAX_RETAKE_WINDOW_MS) return null
  const abandonFromWi = words.findIndex((w) => msFromS(w.s) >= abandonStartMs - 1)
  const fromWi = abandonFromWi >= 0 ? abandonFromWi : 0
  return {
    attempts: [
      {
        startMs: abandonStartMs,
        endMs: keepStartMs,
        text: textSlice(words, fromWi, words.findIndex((w) => msFromS(w.s) >= keepStartMs) || keepEndWi),
      },
      {
        startMs: keepStartMs,
        endMs: msFromS(words[Math.min(words.length - 1, keepEndWi - 1)]?.e ?? words[words.length - 1]!.e),
        text: textSlice(
          words,
          words.findIndex((w) => msFromS(w.s) >= keepStartMs - 1),
          keepEndWi,
        ),
      },
    ],
    keepIndex: 1,
  }
}

function detectRetakeGroups(words: RetakeWord[]): RetakeGroup[] {
  if (words.length < 4) return []
  const toks = buildTokenStream(words)
  if (toks.length < 4) return []
  const out: RetakeGroup[] = []

  const S = (wi: number) => msFromS(words[wi]!.s)

  // Rule A — immediate phrase repeat (word-index spans)
  for (let p = 0; p < toks.length; p++) {
    let matched = false
    for (let k = 4; k >= 2; k--) {
      const q = p + k
      if (q + k > toks.length) continue
      let ok = true
      for (let i = 0; i < k; i++) {
        if (toks[p + i]!.t !== toks[q + i]!.t) ok = false
      }
      if (!ok) continue
      const strong = toks.slice(p, p + k).some((x) => x.t.length >= 4 && !WEAK.has(x.t))
      if (!strong && k < 3) continue
      const fromWi = toks[p]!.wf
      const toWi = toks[q]!.wf
      if (abandonHasHardPunct(words, fromWi, toWi)) continue
      const keepStart = S(toks[q]!.wf)
      const keepEnd = keptEndWi(words, toks, q, k)
      const g = candidateToGroup(words, S(toks[p]!.wf), keepStart, keepEnd)
      if (g) out.push(g)
      matched = true
      break
    }
    if (matched) continue
  }

  // Rule B — truncated restart (… / — / ...)
  for (let t = 0; t < toks.length - 1; t++) {
    const truncWi = toks[t]!.wi
    if (!TRUNC_END.test(words[truncWi]!.w.trim()) && !TRUNC_WORD.test(words[truncWi]!.w.trim())) continue
    const q = t + 1
    if (words[toks[q]!.wi].s - words[truncWi].e > 1.5) continue
    for (let p = Math.max(0, t - 3); p <= t; p++) {
      if (toks[p]!.t !== toks[q]!.t) continue
      const keepStart = S(toks[q]!.wf)
      const keepEnd = Math.min(words.length, toks[q]!.wi + 6)
      const g = candidateToGroup(words, S(toks[p]!.wf), keepStart, keepEnd)
      if (g) out.push(g)
      break
    }
  }

  // Rule C — adjacent sentences, shared head (any length after stream split)
  const sents: number[][] = []
  let cur: number[] = []
  for (let ti = 0; ti < toks.length; ti++) {
    cur.push(ti)
    const wi = toks[ti]!.wi
    if (SENTENCE_END.test(words[wi]!.w.trim()) || TRUNC_END.test(words[wi]!.w.trim())) {
      sents.push(cur)
      cur = []
    }
  }
  if (cur.length) sents.push(cur)

  for (let i = 0; i + 1 < sents.length; i++) {
    const a = sents[i]!
    const b = sents[i + 1]!
    if (!a.length || !b.length) continue
    let k = 0
    while (k < a.length && k < b.length && toks[a[k]!]!.t === toks[b[k]!]!.t) k++
    if (k < 3) continue
    const aLastWi = toks[a[a.length - 1]!]!.wi
    if (TRUNC_END.test(words[aLastWi]!.w.trim()) || TRUNC_WORD.test(words[aLastWi]!.w.trim())) continue
    const bFirstWf = toks[b[0]!]!.wf
    const bFirstWi = toks[b[0]!]!.wi
    if (words[bFirstWi].s - words[aLastWi].e > 1.5) continue
    let startTi = a[0]!
    const prevS = sents[i - 1]
    if (prevS && prevS.length <= 2) {
      const prevLastWi = toks[prevS[prevS.length - 1]!]!.wi
      if (TRUNC_END.test(words[prevLastWi]!.w.trim()) || TRUNC_WORD.test(words[prevLastWi]!.w.trim())) {
        startTi = prevS[0]!
      }
    }
    const abandonStart = S(toks[startTi]!.wf)
    const keepStart = S(bFirstWf)
    const keepEnd = Math.min(words.length, toks[b[b.length - 1]!]!.wi + 1)
    const g = candidateToGroup(words, abandonStart, keepStart, keepEnd)
    if (g) out.push(g)
  }

  return out
}

function attemptSpanKey(group: RetakeGroup): string {
  return group.attempts.map((a) => `${a.startMs}:${a.endMs}`).join('|')
}

function dedupeRetakeGroups(groups: RetakeGroup[]): RetakeGroup[] {
  const seen = new Set<string>()
  const out: RetakeGroup[] = []
  for (const g of groups) {
    const key = attemptSpanKey(g)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(g)
  }
  return out
}

function collapseRetakeGroups(groups: RetakeGroup[], existingCuts: CutRange[]): RetakeGroup[] {
  const out: RetakeGroup[] = []
  for (const g of groups) {
    const keep = g.attempts[g.keepIndex]!
    const keepKey = `${keep.startMs}:${keep.endMs}`
    const existing = out.find((o) => {
      const ok = o.attempts[o.keepIndex]!
      return `${ok.startMs}:${ok.endMs}` === keepKey
    })
    if (existing) {
      const rangeA = retakeCutRange(existing, existingCuts)
      const rangeB = retakeCutRange(g, existingCuts)
      const cutA = rangeA ? rangeA[1] - rangeA[0] : Number.MAX_SAFE_INTEGER
      const cutB = rangeB ? rangeB[1] - rangeB[0] : Number.MAX_SAFE_INTEGER
      if (cutB < cutA) {
        const ix = out.indexOf(existing)
        out[ix] = g
      }
      continue
    }
    out.push(g)
  }
  return out
}

function capRetakeGroups(groups: RetakeGroup[], max: number, existingCuts: CutRange[]): RetakeGroup[] {
  const scored = groups
    .map((g) => ({ g, cut: retakeCutRange(g, existingCuts) }))
    .filter((x): x is { g: RetakeGroup; cut: CutRange } => x.cut != null)
    .sort((a, b) => a.cut[1] - a.cut[0] - (b.cut[1] - b.cut[0]))
  const out: RetakeGroup[] = []
  for (const { g, cut } of scored) {
    if (out.length >= max) break
    const overlaps = out.some((o) => {
      const oc = retakeCutRange(o, existingCuts)
      if (!oc) return false
      return Math.max(cut[0], oc[0]) < Math.min(cut[1], oc[1])
    })
    if (!overlaps) out.push(g)
  }
  return out
}

function filterRetakeGroups(groups: RetakeGroup[], existingCuts: CutRange[]): RetakeGroup[] {
  const filtered = collapseRetakeGroups(dedupeRetakeGroups(groups), existingCuts).filter((g) => {
    if (g.attempts.length < 2) return false
    const cut = retakeCutRange(g, existingCuts)
    if (!cut) return false
    const len = cut[1] - cut[0]
    if (len < MIN_RETAKE_CUT_MS || len > MAX_RETAKE_CUT_MS) return false
    const first = g.attempts[0]!
    const keep = g.attempts[g.keepIndex]!
    if (keep.startMs - first.startMs > MAX_RETAKE_WINDOW_MS) return false
    return true
  })
  return capRetakeGroups(filtered, MAX_RETAKE_GROUPS, existingCuts)
}

export function findRetakes(words: RetakeWord[], existingCuts: CutRange[] = []): RetakeGroup[] {
  return filterRetakeGroups(detectRetakeGroups(words), existingCuts)
}

/** Legacy helper — splits on punctuation / long gaps (used in tests). */
export function splitSentences(words: RetakeWord[]): RetakeWord[][] {
  if (!words.length) return []
  const sentences: RetakeWord[][] = []
  let cur: RetakeWord[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    if (cur.length && gapMs(cur[cur.length - 1]!, w) >= 700) {
      if (cur.length >= 1) sentences.push(cur)
      cur = []
    }
    cur.push(w)
    if (SENTENCE_END.test(w.w.trim()) || TRUNC_END.test(w.w.trim())) {
      if (cur.length >= 1) sentences.push(cur)
      cur = []
    }
  }
  if (cur.length) sentences.push(cur)
  return sentences
}

function isRangeFullyCut(range: CutRange, cuts: CutRange[]): boolean {
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  if (hi <= lo) return true
  for (const c of cuts) {
    const cl = Math.min(c[0], c[1])
    const ch = Math.max(c[0], c[1])
    if (cl <= lo && ch >= hi) return true
  }
  return false
}

/** Cut everything before the kept attempt; skip if already fully cut. */
export function retakeCutRange(group: RetakeGroup, existingCuts: CutRange[] = []): CutRange | null {
  const keep = group.attempts[group.keepIndex]
  const first = group.attempts[0]
  if (!keep || !first || group.keepIndex <= 0) return null
  const range: CutRange = [first.startMs, keep.startMs]
  if (range[1] <= range[0]) return null
  if (range[1] - range[0] > MAX_RETAKE_CUT_MS) return null
  if (isRangeFullyCut(range, existingCuts)) return null
  return range
}

export function retakeCutRanges(group: RetakeGroup, existingCuts: CutRange[] = []): CutRange[] {
  const one = retakeCutRange(group, existingCuts)
  return one ? [one] : []
}

export function retakeGroupWithKeepIndex(group: RetakeGroup, keepIndex: number): RetakeGroup {
  const k = Math.max(0, Math.min(group.attempts.length - 1, keepIndex))
  return { ...group, keepIndex: k }
}
