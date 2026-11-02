import type { CutRange } from '@/lib/clips/edits'

export type RetakeWord = { w: string; s: number; e: number }

export type RetakeAttempt = { startMs: number; endMs: number; text: string }

export type RetakeGroup = { attempts: RetakeAttempt[]; keepIndex: number }

const SENTENCE_END = /[.!?]["']?$/
const MAX_RETAKE_WINDOW_S = 10
const MAX_RETAKE_CUT_MS = 15_000
const MIN_SHARED_PREFIX_WORDS = 2

const RETAKE_STOP = new Set(['um', 'uh', 'er', 'ah', 'hmm', 'mm', 'like', 'so', 'and', 'the', 'a', 'i'])

function gapMs(a: RetakeWord, b: RetakeWord): number {
  return Math.max(0, b.s * 1000 - a.e * 1000)
}

function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']/gu, '')
    .trim()
}

function sentenceTokens(words: RetakeWord[]): string[] {
  return words.map((w) => normalizeToken(w.w)).filter(Boolean)
}

function contentTokens(words: RetakeWord[]): string[] {
  return sentenceTokens(words).filter((t) => !RETAKE_STOP.has(t))
}

function sharedPrefixLen(a: string[], b: string[]): number {
  const n = Math.min(a.length, b.length)
  let k = 0
  while (k < n && a[k] === b[k]) k += 1
  return k
}

export function splitSentences(words: RetakeWord[]): RetakeWord[][] {
  if (!words.length) return []
  const sentences: RetakeWord[][] = []
  let cur: RetakeWord[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    if (cur.length && gapMs(cur[cur.length - 1]!, w) >= 700) {
      if (sentenceTokens(cur).length >= 3) sentences.push(cur)
      cur = []
    }
    cur.push(w)
    const endPunct = SENTENCE_END.test(w.w.trim())
    if (endPunct) {
      if (sentenceTokens(cur).length >= 3) sentences.push(cur)
      cur = []
    }
  }
  if (cur.length && sentenceTokens(cur).length >= 3) sentences.push(cur)
  return sentences
}

function lcsLen(a: string[], b: string[]): number {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i]![j] = dp[i - 1]![j - 1]! + 1
      else dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
    }
  }
  return dp[m]![n]!
}

function tokenSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  return lcsLen(a, b) / Math.max(a.length, b.length)
}

function sentencesMatch(a: RetakeWord[], b: RetakeWord[]): boolean {
  const ta = contentTokens(a)
  const tb = contentTokens(b)
  if (ta.length < 3 || tb.length < 3) return false
  if (sharedPrefixLen(ta, tb) >= MIN_SHARED_PREFIX_WORDS) return true
  const headA = ta.slice(0, 3)
  const headB = tb.slice(0, 3)
  if (headA.length >= 3 && headA.every((t, i) => t === headB[i])) return true
  return tokenSimilarity(ta, tb) >= 0.72
}

function attemptFromSentence(sentence: RetakeWord[]): RetakeAttempt {
  const startMs = Math.round(sentence[0]!.s * 1000)
  const endMs = Math.round(sentence[sentence.length - 1]!.e * 1000)
  return { startMs, endMs, text: sentence.map((w) => w.w).join(' ') }
}

function sentenceStartS(sentence: RetakeWord[]): number {
  return sentence[0]?.s ?? 0
}

function falseStartGroups(words: RetakeWord[]): RetakeGroup[] {
  const sentences = splitSentences(words)
  const out: RetakeGroup[] = []
  for (const sentence of sentences) {
    const tokens = sentenceTokens(sentence)
    if (tokens.length < 5) continue

    const pushSplit = (splitTokenIndex: number) => {
      if (splitTokenIndex < 2 || splitTokenIndex > tokens.length - 3) return
      const firstWords = sentence.slice(0, splitTokenIndex)
      const secondWords = sentence.slice(splitTokenIndex)
      if (sentenceTokens(firstWords).length >= 2 && sentenceTokens(secondWords).length >= 3) {
        out.push({
          attempts: [attemptFromSentence(firstWords), attemptFromSentence(secondWords)],
          keepIndex: 1,
        })
      }
    }

    const head = tokens.slice(0, 3)
    for (let i = 3; i <= tokens.length - 3; i++) {
      const slice = tokens.slice(i, i + 3)
      if (head.every((t, j) => t === slice[j])) {
        pushSplit(i)
        break
      }
    }

    for (let i = 1; i < tokens.length - 3; i++) {
      for (let j = i + 1; j < tokens.length - 2; j++) {
        if (tokens[i] === tokens[j] && tokens[i + 1] === tokens[j + 1]) {
          pushSplit(j)
          break
        }
      }
    }
  }
  return out
}

export function findRetakes(words: RetakeWord[]): RetakeGroup[] {
  const sentences = splitSentences(words)
  if (sentences.length < 2) return falseStartGroups(words)

  const parent = sentences.map((_, i) => i)
  const find = (i: number): number => {
    if (parent[i] === i) return i
    parent[i] = find(parent[i]!)
    return parent[i]!
  }
  const unite = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  for (let i = 0; i < sentences.length; i++) {
    const startS = sentenceStartS(sentences[i]!)
    for (let j = i + 1; j < sentences.length; j++) {
      if (sentenceStartS(sentences[j]!) - startS > MAX_RETAKE_WINDOW_S) break
      if (sentencesMatch(sentences[i]!, sentences[j]!)) unite(i, j)
    }
  }

  const buckets = new Map<number, number[]>()
  for (let i = 0; i < sentences.length; i++) {
    const root = find(i)
    const list = buckets.get(root) ?? []
    list.push(i)
    buckets.set(root, list)
  }

  const groups: RetakeGroup[] = []
  for (const idxs of buckets.values()) {
    if (idxs.length < 2) continue
    idxs.sort((a, b) => a - b)
    const attempts = idxs.map((ix) => attemptFromSentence(sentences[ix]!))
    groups.push({ attempts, keepIndex: attempts.length - 1 })
  }
  return [...groups, ...falseStartGroups(words)]
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
