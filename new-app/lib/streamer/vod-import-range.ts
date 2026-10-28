/** Paste-a-VOD test slice: limit analyze/render to part of a long VOD. */

export type VodImportRangeMode = 'full' | 'first_minutes' | 'last_minutes' | 'start_end'

export const LIVE_CLIP_LAST_MINUTE_PRESETS = [5, 15, 30, 60] as const

export type VodImportRangeInput = {
  mode: VodImportRangeMode
  /** Used when mode === 'first_minutes' */
  firstMinutes?: number
  /** Used when mode === 'last_minutes' (tail of VOD at resolve time) */
  lastMinutes?: number
  /** HH:MM:SS, MM:SS, or seconds — used when mode === 'start_end' */
  start?: string
  end?: string
}

export function parseClockToMs(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  if (/^\d+(\.\d+)?$/.test(t)) {
    const sec = parseFloat(t)
    if (!Number.isFinite(sec) || sec < 0) return null
    return Math.round(sec * 1000)
  }
  const parts = t.split(':').map((p) => p.trim())
  if (parts.length < 2 || parts.length > 3) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null
  let h = 0
  let m = 0
  let s = 0
  if (nums.length === 2) {
    ;[m, s] = nums
  } else {
    ;[h, m, s] = nums
  }
  if (m >= 60 || s >= 60) return null
  return Math.round((h * 3600 + m * 60 + s) * 1000)
}

export function resolveVodImportRangeMs(
  input: VodImportRangeInput,
  opts?: { maxSpanMinutes?: number; vodDurationMs?: number },
): { rangeStartMs: number; rangeEndMs: number } | { error: string } {
  const maxSpan = (opts?.maxSpanMinutes ?? 12 * 60) * 60_000
  if (input.mode === 'full') {
    return { rangeStartMs: 0, rangeEndMs: 0 }
  }
  if (input.mode === 'last_minutes') {
    const durationMs = opts?.vodDurationMs
    if (durationMs == null || durationMs <= 0) {
      return { error: 'Resolve the channel or VOD first to set a live tail range.' }
    }
    const mins = input.lastMinutes ?? 5
    if (!Number.isFinite(mins) || mins <= 0 || mins > 12 * 60) {
      return { error: 'Choose between 1 and 720 minutes for the live tail slice.' }
    }
    const span = Math.round(mins * 60_000)
    const end = durationMs
    const start = Math.max(0, end - span)
    return { rangeStartMs: start, rangeEndMs: end }
  }
  if (input.mode === 'first_minutes') {
    const mins = input.firstMinutes ?? 15
    if (!Number.isFinite(mins) || mins <= 0 || mins > 12 * 60) {
      return { error: 'Choose between 1 and 720 minutes for the test slice.' }
    }
    const end = Math.round(mins * 60_000)
    return { rangeStartMs: 0, rangeEndMs: end }
  }
  const startMs = parseClockToMs(input.start ?? '0') ?? 0
  const endMs = parseClockToMs(input.end ?? '')
  if (endMs == null) {
    return { error: 'Enter an end time (HH:MM:SS or minutes).' }
  }
  if (endMs <= startMs) {
    return { error: 'End time must be after start time.' }
  }
  if (endMs - startMs > maxSpan) {
    return { error: 'Slice cannot exceed 12 hours.' }
  }
  return { rangeStartMs: startMs, rangeEndMs: endMs }
}
