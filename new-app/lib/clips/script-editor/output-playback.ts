import { outputTimeToSourceMs, sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import type { EdlSegment } from '@/lib/clips/script-edl/types'
import { outputDurationMs } from '@/lib/clips/script-edl/edl-playback'

/** True when preview must advance on output time (gap segments, not only source cuts). */
export function edlUsesOutputClock(edl: EdlSegment[]): boolean {
  return edl.some((s) => s.kind === 'gap')
}

export function clampOutputMs(outMs: number, edl: EdlSegment[]): number {
  const dur = outputDurationMs(edl)
  return Math.max(0, Math.min(dur, outMs))
}

export function sourceMsAtOutput(outMs: number, edl: EdlSegment[], fallbackSourceMs: number): number {
  const src = outputTimeToSourceMs(outMs, edl)
  return src ?? fallbackSourceMs
}

export function outputMsAtSource(srcMs: number, edl: EdlSegment[], rangeStartMs: number): number {
  return sourceMsToOutputTime(srcMs, edl) ?? Math.max(0, srcMs - rangeStartMs)
}
