import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

export type ExcerptParts = { before: string; removed: string; after: string }

/** Text removed by a cut range with ±context for review cards. */
export function excerptPartsForCutRange(
  orderedWords: EditorWord[],
  range: [number, number],
  opts?: { contextWords?: number },
): ExcerptParts | null {
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  const ctx = opts?.contextWords ?? 3
  const inCut: string[] = []
  const before: string[] = []
  const after: string[] = []
  for (const w of orderedWords) {
    const mid = (w.t0Ms + w.t1Ms) / 2
    if (mid >= lo && mid <= hi) inCut.push(w.text)
    else if (mid < lo) before.push(w.text)
    else if (mid > hi) after.push(w.text)
  }
  if (!inCut.length) return null
  return {
    before: before.slice(-ctx).join(' '),
    removed: inCut.join(' '),
    after: after.slice(0, ctx).join(' '),
  }
}

/** Text removed by a cut range with ±context for review cards. */
export function excerptForCutRange(
  orderedWords: EditorWord[],
  range: [number, number],
  opts?: { contextWords?: number; maxLen?: number },
): string {
  const parts = excerptPartsForCutRange(orderedWords, range, opts)
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  if (!parts) return `(${Math.round(lo)}–${Math.round(hi)} ms)`
  const maxLen = opts?.maxLen ?? 120
  const b = parts.before
  const a = parts.after
  const core = parts.removed
  let out = [b && `…${b}`, core, a && `${a}…`].filter(Boolean).join(' ')
  if (out.length > maxLen) out = `${out.slice(0, maxLen - 1)}…`
  return out
}
