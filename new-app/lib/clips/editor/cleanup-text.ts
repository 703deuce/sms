import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

/** Text removed by a cut range with ±context for review cards. */
export function excerptForCutRange(
  orderedWords: EditorWord[],
  range: [number, number],
  opts?: { contextWords?: number; maxLen?: number },
): string {
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  const ctx = opts?.contextWords ?? 3
  const maxLen = opts?.maxLen ?? 120
  const inCut: string[] = []
  const before: string[] = []
  const after: string[] = []
  for (const w of orderedWords) {
    const mid = (w.t0Ms + w.t1Ms) / 2
    if (mid >= lo && mid <= hi) inCut.push(w.text)
    else if (mid < lo) before.push(w.text)
    else if (mid > hi) after.push(w.text)
  }
  if (!inCut.length) return `(${Math.round(lo)}–${Math.round(hi)} ms)`
  const b = before.slice(-ctx).join(' ')
  const a = after.slice(0, ctx).join(' ')
  const core = inCut.join(' ')
  let out = [b && `…${b}`, core, a && `${a}…`].filter(Boolean).join(' ')
  if (out.length > maxLen) out = `${out.slice(0, maxLen - 1)}…`
  return out
}
