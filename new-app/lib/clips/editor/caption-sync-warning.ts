import { buildCaptionWords, type CaptionSourceWord, type CaptionWord } from '../caption-words'
import { displayDurationMs, type ClipEditsV2 } from '../edits'
import type { CaptionLine } from './caption-lines'

/** Drift large enough that burned-in captions / SRT would visibly miss the words. */
export const CAPTION_SYNC_DRIFT_MS = 500

export type CaptionSyncWarning = {
  level: 'warning'
  code:
    | 'invalid_times'
    | 'non_monotonic'
    | 'past_duration'
    | 'source_clock'
    | 'line_transcript_drift'
  message: string
}

export type CaptionSyncSourceWord = {
  i?: number
  idx?: number
  w: string
  s: number
  e: number
  spk?: number
}

function toCaptionSourceWords(words: CaptionSyncSourceWord[]): CaptionSourceWord[] {
  return words.map((w, index) => ({
    i: typeof w.i === 'number' ? w.i : typeof w.idx === 'number' ? w.idx : index,
    w: w.w,
    s: w.s,
    e: w.e,
    ...(w.spk !== undefined ? { spk: w.spk } : {}),
  }))
}

function lineOverlapMs(line: CaptionLine, word: CaptionWord): number {
  const start = Math.max(line.startMs, word.s_ms)
  const end = Math.min(line.endMs, word.e_ms)
  return Math.max(0, end - start)
}

function nearestWordDriftMs(line: CaptionLine, words: CaptionWord[]): number | null {
  if (!words.length) return null
  const mid = (line.startMs + line.endMs) / 2
  let best = Number.POSITIVE_INFINITY
  for (const word of words) {
    if (lineOverlapMs(line, word) > 0) return 0
    const wmid = (word.s_ms + word.e_ms) / 2
    best = Math.min(best, Math.abs(wmid - mid))
  }
  return Number.isFinite(best) ? best : null
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2
  return sorted[mid]!
}

/**
 * Detect caption timing that would ship out of sync with the transcript/audio.
 * Conservative: no warning when words are missing (not yet loaded) or when
 * speech simply does not fill the full clip duration.
 */
export function detectCaptionSyncIssues(args: {
  words?: CaptionSyncSourceWord[]
  edits: ClipEditsV2
  durationMs?: number
}): CaptionSyncWarning[] {
  const cap = args.edits.captions
  if (cap?.enabled === false) return []

  const durationMs = Math.max(
    0,
    Math.round(args.durationMs ?? displayDurationMs(args.edits)),
  )
  const warnings: CaptionSyncWarning[] = []
  const lines = args.edits.captionLines ?? []
  const captionWords = buildCaptionWords(toCaptionSourceWords(args.words ?? []), args.edits)

  const timed = lines.length
    ? lines.map((l) => ({ startMs: l.startMs, endMs: l.endMs, id: l.id }))
    : captionWords.map((w) => ({ startMs: w.s_ms, endMs: w.e_ms, id: String(w.i) }))

  let invalid = false
  let nonMonotonic = false
  let pastDuration = false
  for (let i = 0; i < timed.length; i++) {
    const row = timed[i]!
    if (!Number.isFinite(row.startMs) || !Number.isFinite(row.endMs) || row.endMs <= row.startMs) {
      invalid = true
      continue
    }
    if (durationMs > 0 && row.startMs > durationMs + CAPTION_SYNC_DRIFT_MS) {
      pastDuration = true
    }
    if (i > 0) {
      const prev = timed[i - 1]!
      if (row.startMs + 20 < prev.startMs) nonMonotonic = true
      if (prev.endMs - row.startMs > 200 && row.startMs < prev.startMs) nonMonotonic = true
    }
  }
  if (invalid) {
    warnings.push({
      level: 'warning',
      code: 'invalid_times',
      message: 'A caption cue has invalid start or end time. Fix the timing before export.',
    })
  }
  if (nonMonotonic) {
    warnings.push({
      level: 'warning',
      code: 'non_monotonic',
      message: 'Caption cues are out of order or overlap heavily. Preview may not match the audio.',
    })
  }
  if (pastDuration) {
    warnings.push({
      level: 'warning',
      code: 'past_duration',
      message: 'Some caption cues start after the clip ends, so they will not play in sync.',
    })
  }

  const trimIn = args.edits.trim?.in ?? 0
  if (lines.length >= 1 && trimIn > 2000) {
    const minStart = Math.min(...lines.map((l: CaptionLine) => l.startMs))
    if (minStart > 2000 && Math.abs(minStart - trimIn) < CAPTION_SYNC_DRIFT_MS) {
      warnings.push({
        level: 'warning',
        code: 'source_clock',
        message:
          'Caption times look like source-file time, not the edited clip. They may drift from the audio in preview and export.',
      })
    }
  }

  if (lines.length >= 3 && captionWords.length >= 3) {
    const drifts = lines
      .map((line: CaptionLine) => nearestWordDriftMs(line, captionWords))
      .filter((v: number | null): v is number => v !== null)
    if (drifts.length >= 3 && median(drifts) > CAPTION_SYNC_DRIFT_MS) {
      warnings.push({
        level: 'warning',
        code: 'line_transcript_drift',
        message:
          'Caption timing has drifted from the transcript. Preview and export (burned-in and SRT) will not stay in sync until you fix the cues.',
      })
    }
  }

  return warnings
}

export function primaryCaptionSyncWarning(
  args: Parameters<typeof detectCaptionSyncIssues>[0],
): CaptionSyncWarning | null {
  return detectCaptionSyncIssues(args)[0] ?? null
}
