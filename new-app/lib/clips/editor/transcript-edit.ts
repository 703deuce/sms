import type { ClipWord, CutRange } from '@/lib/clips/edits'

export const PARA_SENTENCE_GAP_MS = 700
export const PARA_HARD_GAP_MS = 1500
export const PARA_MAX_WORDS = 60
const SENTENCE_END = /[.!?…]["')\]]*$/
type IdxWord = ClipWord & { i: number }
type Fixes = Record<string, string>
type Meta = Record<string, { s: number; w: string }>

export function isWordIgnored(i: number, fixes: Fixes): boolean {
  return Object.prototype.hasOwnProperty.call(fixes, String(i)) && fixes[String(i)] === ''
}

/** TB-06: ignore (on) / unignore (off) words; returns new wordFixes + wordFixMeta (meta undefined when empty). */
export function setWordsIgnored(
  fixes: Fixes,
  meta: Meta | undefined,
  words: IdxWord[],
  on: boolean,
): { wordFixes: Fixes; wordFixMeta: Meta | undefined } {
  const f = { ...fixes }
  const m = { ...(meta ?? {}) }
  for (const w of words) {
    const k = String(w.i)
    if (on) {
      f[k] = ''
      m[k] = { s: w.s, w: w.w }
    } else if (f[k] === '') {
      delete f[k]
      delete m[k]
    }
  }
  return { wordFixes: f, wordFixMeta: Object.keys(m).length ? m : undefined }
}

/** TB-06 toggle rule: unignore when every word is already ignored, else ignore. */
export function nextIgnoreState(words: IdxWord[], fixes: Fixes): boolean {
  return !(words.length > 0 && words.every((w) => isWordIgnored(w.i, fixes)))
}

/** TB-07: does [a, b) (source ms) overlap any cut? */
export function selectionHasCuts(cutRanges: CutRange[], a: number, b: number): boolean {
  return cutRanges.some(([s, e]) => s < b && e > a)
}

export type ScriptRun<W> = { kind: 'word'; w: W } | { kind: 'removed'; words: W[]; range: CutRange }
/** TB-07 "Show deleted" off: collapse contiguous cut words into one run (range = first.s..last.e, ms). */
export function collapseCutRuns<W extends ClipWord>(words: W[], isCut: (w: W) => boolean): ScriptRun<W>[] {
  const out: ScriptRun<W>[] = []
  for (const w of words) {
    if (!isCut(w)) {
      out.push({ kind: 'word', w })
      continue
    }
    const last = out[out.length - 1]
    if (last?.kind === 'removed') {
      last.words.push(w)
      last.range = [last.range[0], Math.round(w.e * 1000)]
    } else out.push({ kind: 'removed', words: [w], range: [Math.round(w.s * 1000), Math.round(w.e * 1000)] })
  }
  return out
}

/** TB-08: word indexes (w.i) that start a new paragraph inside one speaker block (never the first word). */
export function paragraphStarts(words: IdxWord[], display: (w: IdxWord) => string): Set<number> {
  const out = new Set<number>()
  let since = 0
  for (let k = 1; k < words.length; k++) {
    const prev = words[k - 1]!
    const w = words[k]!
    since++
    const gap = (w.s - prev.e) * 1000
    const ends = SENTENCE_END.test(display(prev).trim() || prev.w.trim())
    if ((ends && gap >= PARA_SENTENCE_GAP_MS) || gap >= PARA_HARD_GAP_MS || (ends && since >= PARA_MAX_WORDS)) {
      out.add(w.i)
      since = 0
    }
  }
  return out
}

/** TB-15: w.i of the word containing ms (words sorted by s), else null. Binary search. */
export function activeWordAt(words: IdxWord[], ms: number | null | undefined): number | null {
  if (ms == null || !Number.isFinite(ms) || !words.length) return null
  let lo = 0
  let hi = words.length - 1
  let hit = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (words[mid]!.s * 1000 <= ms) {
      hit = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (hit < 0) return null
  const w = words[hit]!
  return ms < w.e * 1000 ? w.i : null
}

/** TB-08: sanitize edits.speakerNames ({ 'A': 'Chad' }); undefined when empty. */
export function normalizeSpeakerNames(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= 8) break
    if (!/^[A-Za-z0-9]{1,4}$/.test(k) || typeof v !== 'string') continue
    const name = v.trim().slice(0, 32)
    if (name) out[k] = name
  }
  return Object.keys(out).length ? out : undefined
}

export function setSpeakerName(names: Record<string, string> | undefined, spk: string, name: string) {
  return normalizeSpeakerNames({ ...(names ?? {}), [spk]: name })
}

export function speakerDisplayName(names: Record<string, string> | undefined, spk: string, num: number): string {
  return names?.[spk] || `Speaker ${num}`
}
