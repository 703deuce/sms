/**
 * SCRIPT_DOC2: "Correct text" for auto captions. Turns a retyped caption group into per-word text
 * fixes (edits.wordFixes / wordFixMeta). Text only: cutRanges, word timing, playback and duration
 * never change.
 *
 * Words the new text still contains keep their own text (case / punctuation updates are fixes).
 * Changed words take the new token in order. Extra tokens (a missed spoken word, e.g. "didn't")
 * join the word before them (or the next word at the start of the group). Words the new text drops
 * become "ignored" ('' fix): still in the video, hidden from captions.
 */
export type FixWord = {
  /** Source word index (edits.wordFixes key). */
  i: number
  /** Original ASR text. */
  w: string
  /** Source start (ms), stored as the fix's anchor like the transcript's word edit. */
  sMs: number
  /** Text currently shown (after existing fixes). */
  shown: string
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')

/** New text per word index; '' = hide from captions. Null when the typed text is empty. */
export function alignCaptionText(words: FixWord[], typed: string): Map<number, string> | null {
  const toks = typed.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!toks.length || !words.length) return null
  const m = words.length
  const n = toks.length
  const eq = (a: number, b: number) => {
    const x = norm(words[a]!.shown)
    return x !== '' && x === norm(toks[b]!)
  }
  const L: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let a = m - 1; a >= 0; a--) {
    for (let b = n - 1; b >= 0; b--) {
      L[a]![b] = eq(a, b) ? L[a + 1]![b + 1]! + 1 : Math.max(L[a + 1]![b]!, L[a]![b + 1]!)
    }
  }
  const pairs: [number, number][] = []
  let a = 0
  let b = 0
  while (a < m && b < n) {
    if (eq(a, b) && L[a]![b] === L[a + 1]![b + 1]! + 1) {
      pairs.push([a, b])
      a++
      b++
    } else if (L[a + 1]![b]! >= L[a]![b + 1]!) a++
    else b++
  }
  pairs.push([m, n])
  const out = new Map<number, string[]>()
  for (const w of words) out.set(w.i, [])
  let pa = 0
  let pb = 0
  for (const [ma, mb] of pairs) {
    const ws = words.slice(pa, ma)
    const ts = toks.slice(pb, mb)
    for (let k = 0; k < ws.length && k < ts.length; k++) out.get(ws[k]!.i)!.push(ts[k]!)
    const extra = ts.slice(ws.length)
    if (extra.length) {
      const host = ws.length ? ws[ws.length - 1]! : pa > 0 ? words[pa - 1]! : ma < m ? words[ma]! : null
      if (host) out.get(host.i)!.push(...extra)
    }
    if (ma < m) out.get(words[ma]!.i)!.push(toks[mb]!)
    pa = ma + 1
    pb = mb + 1
  }
  const res = new Map<number, string>()
  for (const w of words) res.set(w.i, out.get(w.i)!.join(' '))
  return res
}

/** Apply alignCaptionText to wordFixes / wordFixMeta (text only). */
export function captionTextFixEdits(
  fixes: Record<string, string> | undefined,
  meta: Record<string, { s: number; w: string }> | undefined,
  words: FixWord[],
  typed: string,
): { wordFixes: Record<string, string>; wordFixMeta: Record<string, { s: number; w: string }> | undefined } | null {
  const next = alignCaptionText(words, typed)
  if (!next) return null
  const f = { ...(fixes ?? {}) }
  const m = { ...(meta ?? {}) }
  for (const w of words) {
    const k = String(w.i)
    const t = next.get(w.i) ?? ''
    if (t === w.w) {
      delete f[k]
      delete m[k]
    } else {
      f[k] = t
      m[k] = { s: w.sMs, w: w.w }
    }
  }
  return { wordFixes: f, wordFixMeta: Object.keys(m).length ? m : undefined }
}
