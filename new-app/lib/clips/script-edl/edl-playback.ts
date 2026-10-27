import type { EdlSegment } from '@/lib/clips/script-edl/types'
import { outputTimeToSourceMs } from '@/lib/clips/script-edl/derive-edl'

export function outputDurationMs(edl: EdlSegment[]): number {
  let max = 0
  for (const seg of edl) {
    if (seg.kind === 'source') max = Math.max(max, seg.outOutMs)
  }
  return max
}

export function isSourceMsInEdl(srcMs: number, edl: EdlSegment[]): boolean {
  for (const seg of edl) {
    if (seg.kind !== 'source') continue
    if (srcMs >= seg.srcInMs && srcMs <= seg.srcOutMs) return true
  }
  return false
}

/** If playhead is in a cut gap, return the next kept source position (ms). */
export function nextKeptSourceMs(srcMs: number, edl: EdlSegment[]): number | null {
  let best: number | null = null
  for (const seg of edl) {
    if (seg.kind !== 'source') continue
    if (seg.srcInMs > srcMs + 5) {
      best = seg.srcInMs
      break
    }
    if (srcMs >= seg.srcInMs && srcMs <= seg.srcOutMs) return null
  }
  if (best !== null) return best
  return null
}

export function sourceMsForOutputTime(outMs: number, edl: EdlSegment[]): number | null {
  return outputTimeToSourceMs(outMs, edl)
}
