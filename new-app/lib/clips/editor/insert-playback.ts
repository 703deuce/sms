/**
 * E5b preview: when the main video plays INTO an insert point, the preview holds the main clock and
 * plays the inserted clip(s) over it, then resumes. Pure helpers, used by `InsertPlayback` and tests.
 */
import type { InsertWindow } from '@/lib/clips/editor/inserts'

export type InsertCue = {
  /** Main source ms where the main video resumes after the insert(s) (append: the end). */
  resumeSrcMs: number
  append: boolean
  windows: InsertWindow[]
}

/** Group windows by edit-timeline point, with the main source ms each point resumes at. */
export function insertCues(
  segs: readonly [number, number][],
  windows: readonly InsertWindow[],
  appendIds: ReadonlySet<string>,
): InsertCue[] {
  const total = segs.reduce((s, [a, b]) => s + (b - a), 0)
  const srcAtBase = (baseMs: number): number => {
    let acc = 0
    for (const [a, b] of segs) {
      if (baseMs < acc + (b - a)) return a + (baseMs - acc)
      acc += b - a
    }
    return segs.length ? segs[segs.length - 1]![1] : 0
  }
  const cues: InsertCue[] = []
  for (const w of windows) {
    const append = appendIds.has(w.id) || w.baseMs >= total
    const last = cues[cues.length - 1]
    if (last && last.windows[0]!.baseMs === w.baseMs && last.append === append) {
      last.windows.push(w)
      continue
    }
    cues.push({ resumeSrcMs: srcAtBase(w.baseMs), append, windows: [w] })
  }
  return cues
}

/**
 * The cue the main clock just crossed while playing (prev → cur, source ms), or null. Normal playback
 * steps forward a few ms per frame; a jump over a cut lands exactly on the next kept start, which is
 * also where an insert anchored inside that cut resumes. Larger jumps are seeks and never trigger.
 */
export function crossedCue(cues: readonly InsertCue[], prevSrcMs: number, curSrcMs: number, maxStepMs = 400): InsertCue | null {
  if (!(curSrcMs > prevSrcMs)) return null
  for (const c of cues) {
    if (c.append) continue
    if (prevSrcMs < c.resumeSrcMs && c.resumeSrcMs <= curSrcMs + 1) {
      const step = curSrcMs - prevSrcMs
      if (step <= maxStepMs || Math.abs(curSrcMs - c.resumeSrcMs) <= 40) return c
    }
  }
  return null
}
