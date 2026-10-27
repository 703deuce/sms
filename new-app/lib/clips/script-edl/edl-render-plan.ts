import type { EdlSegment } from '@/lib/clips/script-edl/types'
import { outputDurationMs } from '@/lib/clips/script-edl/edl-playback'

export function mergedSourceSpansFromEdl(edl: EdlSegment[]): { srcInMs: number; srcOutMs: number }[] {
  const spans: { srcInMs: number; srcOutMs: number }[] = []
  for (const seg of edl) {
    if (seg.kind !== 'source') continue
    const last = spans[spans.length - 1]
    if (last && last.srcOutMs >= seg.srcInMs - 1) {
      last.srcOutMs = Math.max(last.srcOutMs, seg.srcOutMs)
    } else {
      spans.push({ srcInMs: seg.srcInMs, srcOutMs: seg.srcOutMs })
    }
  }
  return spans
}

export function sumMergedSourceSpanMs(edl: EdlSegment[]): number {
  return mergedSourceSpansFromEdl(edl).reduce((n, s) => n + Math.max(0, s.srcOutMs - s.srcInMs), 0)
}

function mergeCutRanges(cuts: number[][]): number[][] {
  const pairs = cuts
    .filter((c) => c.length >= 2)
    .map((c) => [Math.round(c[0]), Math.round(c[1])] as [number, number])
    .sort((a, b) => a[0] - b[0])
  const out: number[][] = []
  for (const [s, e] of pairs) {
    if (e <= s) continue
    const last = out[out.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else out.push([s, e])
  }
  return out
}

/** Inverse of EDL kept source spans → cut silences/deleted regions inside project range. */
export function edlToTrimAndCutRanges(
  edl: EdlSegment[],
  rangeStartMs: number,
  rangeEndMs: number,
): { trimInMs: number; trimOutMs: number; cutRanges: number[][] } {
  const spans = mergedSourceSpansFromEdl(edl)
  if (!spans.length) {
    return { trimInMs: rangeStartMs, trimOutMs: rangeEndMs, cutRanges: [] }
  }
  const trimInMs = Math.max(rangeStartMs, spans[0].srcInMs)
  const trimOutMs = Math.min(rangeEndMs, spans[spans.length - 1].srcOutMs)
  const cuts: number[][] = []
  if (spans[0].srcInMs > trimInMs) cuts.push([trimInMs, spans[0].srcInMs])
  for (let i = 0; i < spans.length - 1; i++) {
    const gapStart = spans[i].srcOutMs
    const gapEnd = spans[i + 1].srcInMs
    if (gapEnd > gapStart + 1) cuts.push([gapStart, gapEnd])
  }
  if (spans[spans.length - 1].srcOutMs < trimOutMs) {
    cuts.push([spans[spans.length - 1].srcOutMs, trimOutMs])
  }
  return { trimInMs, trimOutMs, cutRanges: mergeCutRanges(cuts) }
}

export function edlOutputVsSourceSpanMs(edl: EdlSegment[]): { outputMs: number; sourceSpanMs: number; gapMs: number } {
  const outputMs = outputDurationMs(edl)
  const sourceSpanMs = sumMergedSourceSpanMs(edl)
  const gapMs = edl.filter((s) => s.kind === 'gap').reduce((n, g) => n + g.durMs, 0)
  return { outputMs, sourceSpanMs, gapMs }
}
