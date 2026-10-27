import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

/** Format output timecode with tenths (e.g. 1:05.3). */
export function formatScriptTimecode(ms: number): string {
  const clamped = Math.max(0, ms)
  const totalSec = clamped / 1000
  const tenths = Math.min(9, Math.round((totalSec % 1) * 10))
  const sec = Math.floor(totalSec) % 60
  const min = Math.floor(totalSec / 60) % 60
  const hr = Math.floor(totalSec / 3600)
  if (hr > 0) {
    return `${hr}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenths}`
  }
  return `${min}:${String(sec).padStart(2, '0')}.${tenths}`
}

export function findActiveWordIndex(words: EditorWord[], timeMs: number): number {
  if (!words.length || timeMs < 0) return -1
  let lo = 0
  let hi = words.length - 1
  if (timeMs < words[0].t0Ms) return -1
  if (timeMs >= words[hi].t1Ms) return hi

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const w = words[mid]
    if (timeMs < w.t0Ms) hi = mid - 1
    else if (timeMs >= w.t1Ms) lo = mid + 1
    else return mid
  }
  const idx = Math.min(words.length - 1, Math.max(0, hi))
  if (idx >= 0 && timeMs >= words[idx].t0Ms) return idx
  return Math.max(0, idx)
}

export function sourceTimeMsFromVideo(currentTimeSec: number, rangeStartMs: number): number {
  return Math.round(rangeStartMs + currentTimeSec * 1000)
}

export function videoTimeSecFromSourceMs(sourceMs: number, rangeStartMs: number): number {
  return Math.max(0, (sourceMs - rangeStartMs) / 1000)
}
