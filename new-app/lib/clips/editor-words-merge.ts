import type { ClipWord } from '@/lib/clips/edits'
import { MAX_TRIM_EXTEND_MS } from '@/lib/clips/trim-bounds'
import { loadSourceWords, wordsInRange, type SourceWord } from '@/lib/clips/source-words'
import type { ClipBounds } from '@/lib/clips/edits'
import { extendedTrimLimits } from '@/lib/clips/trim-bounds'

/** Merge clip words with project transcript for extend-trim (±8s). Clip words win on index overlap. */
export function mergeClipWordsWithProjectTranscript(
  clipWords: SourceWord[],
  projectWords: SourceWord[],
  clipStartMs: number,
  clipEndMs: number,
  extendMs = MAX_TRIM_EXTEND_MS,
): SourceWord[] {
  if (!projectWords.length) return clipWords
  const lo = Math.max(0, clipStartMs - extendMs)
  const hi = clipEndMs + extendMs
  const fromProject = wordsInRange(projectWords, lo, hi)
  if (!clipWords.length) return fromProject
  const byIndex = new Map<number, SourceWord>()
  for (const w of fromProject) byIndex.set(w.i, w)
  for (const w of clipWords) byIndex.set(w.i, w)
  return [...byIndex.values()].sort((a, b) => a.s - b.s || a.i - b.i)
}

export function wordTimelineBoundsMs(words: SourceWord[]): { minMs: number; maxMs: number } | null {
  if (!words.length) return null
  let minMs = Infinity
  let maxMs = -Infinity
  for (const w of words) {
    const a = w.s * 1000
    const b = w.e * 1000
    if (a < minMs) minMs = a
    if (b > maxMs) maxMs = b
  }
  return Number.isFinite(minMs) ? { minMs, maxMs } : null
}

/** True when trim extends beyond loaded word coverage (needs merged transcript refetch). */
export function trimNeedsEditorWordsRefetch(
  words: SourceWord[],
  trim: { in: number; out: number },
  bounds: ClipBounds,
  slackMs = 250,
): boolean {
  const { minInMs, maxOutMs } = extendedTrimLimits(bounds.clipStartMs, bounds.clipEndMs)
  if (trim.in < minInMs || trim.out > maxOutMs) return false
  const span = wordTimelineBoundsMs(words)
  if (!span) return true
  if (trim.in < span.minMs - slackMs) return true
  if (trim.out > span.maxMs + slackMs) return true
  return false
}

/** Client-side merge when project transcript bytes are already available (optional path). */
export function mergeEditorWordsFromTranscriptJson(
  clipWords: SourceWord[],
  projectTranscript: ClipWord[],
  bounds: ClipBounds,
): SourceWord[] {
  const project = loadSourceWords(projectTranscript)
  return mergeClipWordsWithProjectTranscript(
    clipWords,
    project,
    bounds.clipStartMs,
    bounds.clipEndMs,
  )
}
