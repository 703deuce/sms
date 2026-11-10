import { buildCaptionWords, type CaptionSourceWord, type CaptionWord } from '../caption-words'
import { displayDurationMs, type ClipEditsV2 } from '../edits'
import { getCaptionLineNormalizeReport, type CaptionLine } from './caption-lines'

/**
 * Caption timing is drifted when the median absolute start/end offset against
 * a cue's own matched transcript words is >= 500ms, or when later cues in a
 * gradual ramp reach that bound. +150ms and +300ms stay quiet; +500ms and
 * +1000ms fire. The 500ms bound is inclusive so a constant +500ms shift is
 * not silently exported.
 */
export const CAPTION_SYNC_DRIFT_MS = 500

export const CAPTION_SYNC_REQUIRED = 'CAPTION_SYNC_REQUIRED'

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

function normalizeToken(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'’]+/gu, '')
}

function cueTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => normalizeToken(part))
    .filter(Boolean)
}

function wordToken(word: CaptionWord): string {
  return normalizeToken(word.text || '')
}

/**
 * Match a cue to its own transcript words by text, walking forward from a
 * moving index so a constant or gradual shift cannot be scored as "in sync"
 * just because the cue overlaps some other word. If text cannot be matched,
 * fall back to the next words in index order.
 */
function cueDriftMs(
  line: CaptionLine,
  words: CaptionWord[],
  cursor: { index: number },
): number | null {
  if (!words.length) return null
  const tokens = cueTokens(line.text)
  if (!tokens.length) return null

  const matched: CaptionWord[] = []
  let idx = cursor.index
  for (const tok of tokens) {
    let found = -1
    for (let i = idx; i < words.length; i++) {
      if (wordToken(words[i]!) === tok) {
        found = i
        break
      }
    }
    if (found < 0) break
    matched.push(words[found]!)
    idx = found + 1
  }

  const used =
    matched.length > 0
      ? matched
      : words.slice(cursor.index, cursor.index + Math.max(1, tokens.length))
  if (!used.length) return null
  cursor.index = matched.length > 0 ? idx : cursor.index + used.length
  const startOff = line.startMs - used[0]!.s_ms
  const endOff = line.endMs - used[used.length - 1]!.e_ms
  return Math.max(Math.abs(startOff), Math.abs(endOff))
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2
  return sorted[mid]!
}

function shouldWarnLineTranscriptDrift(cueDrifts: number[]): boolean {
  if (!cueDrifts.length) return false
  if (median(cueDrifts) >= CAPTION_SYNC_DRIFT_MS) return true
  if (cueDrifts.length === 1) return cueDrifts[0]! >= CAPTION_SYNC_DRIFT_MS
  const later = cueDrifts.slice(Math.floor(cueDrifts.length / 2))
  return median(later) >= CAPTION_SYNC_DRIFT_MS
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
  const normalizeReport = getCaptionLineNormalizeReport(lines)
  const captionWords = buildCaptionWords(toCaptionSourceWords(args.words ?? []), args.edits)

  const timed = lines.length
    ? lines.map((l) => ({ startMs: l.startMs, endMs: l.endMs, id: l.id }))
    : captionWords.map((w) => ({ startMs: w.s_ms, endMs: w.e_ms, id: String(w.i) }))

  let invalid = (normalizeReport?.droppedInvalid ?? 0) > 0
  let nonMonotonic = Boolean(normalizeReport?.reordered)
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

  if (lines.length >= 1 && captionWords.length >= 1) {
    const cursor = { index: 0 }
    const drifts = lines
      .map((line: CaptionLine) => cueDriftMs(line, captionWords, cursor))
      .filter((v: number | null): v is number => v !== null)
    if (shouldWarnLineTranscriptDrift(drifts)) {
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

export function isCaptionSyncRequiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { status?: unknown; code?: unknown }
  return err.status === 409 && err.code === CAPTION_SYNC_REQUIRED
}

const WARNING_CODES: ReadonlySet<CaptionSyncWarning['code']> = new Set([
  'invalid_times',
  'non_monotonic',
  'past_duration',
  'source_clock',
  'line_transcript_drift',
])

export function captionSyncWarningsFromError(error: unknown): CaptionSyncWarning[] {
  if (!error || typeof error !== 'object') return []
  const data = (error as { data?: { warnings?: unknown } }).data
  const raw = data?.warnings
  if (!Array.isArray(raw)) return []
  const out: CaptionSyncWarning[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as { level?: unknown; code?: unknown; message?: unknown }
    if (row.level !== 'warning' || typeof row.code !== 'string' || !WARNING_CODES.has(row.code as CaptionSyncWarning['code'])) {
      continue
    }
    if (typeof row.message !== 'string' || !row.message.trim()) continue
    out.push({
      level: 'warning',
      code: row.code as CaptionSyncWarning['code'],
      message: row.message,
    })
  }
  return out
}
