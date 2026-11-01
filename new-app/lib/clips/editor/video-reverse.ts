/**
 * CV-17b main video reverse — `edits.videoReverse` = [{startMs, endMs}] in SOURCE ms (stabilize
 * precedent). Effective pieces intersect keep segments; preview uses a frame-stepped clone.
 * Mirror: worker clips_worker/video_reverse.py
 */
import { orderedKeepSegments, type ClipEditsV2 } from '@/lib/clips/edits'
import { REVERSE_MAX_MS } from '@/lib/clips/editor/layer-fx'

export type VideoReverseRange = { startMs: number; endMs: number }

export const VIDEO_REVERSE_MAX_RANGES = 50
export const VIDEO_REVERSE_MIN_MS = 100

function pyRound(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

export function normalizeVideoReverse(raw: unknown): VideoReverseRange[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const rows: VideoReverseRange[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const a0 = Number(o.startMs)
    const b0 = Number(o.endMs)
    if (!Number.isFinite(a0) || !Number.isFinite(b0)) continue
    const a = Math.max(0, pyRound(a0))
    const b = pyRound(b0)
    if (b - a < VIDEO_REVERSE_MIN_MS) continue
    if (b - a > REVERSE_MAX_MS) continue
    rows.push({ startMs: a, endMs: b })
  }
  rows.sort((p, q) => p.startMs - q.startMs || p.endMs - q.endMs)
  const out: VideoReverseRange[] = []
  for (let r of rows) {
    const last = out[out.length - 1]
    if (last && r.startMs < last.endMs) {
      r = { ...r, startMs: last.endMs }
      if (r.endMs - r.startMs < VIDEO_REVERSE_MIN_MS) continue
    }
    out.push(r)
  }
  return out.length ? out.slice(0, VIDEO_REVERSE_MAX_RANGES) : undefined
}

/** Source-ms spans that play backwards after intersecting keep segments and length limits. */
export function reversePieces(edits: ClipEditsV2): [number, number][] {
  const ranges = edits.videoReverse
  if (!ranges?.length) return []
  const segs = orderedKeepSegments(edits)
  const out: [number, number][] = []
  for (const [s0, s1] of segs) {
    for (const r of ranges) {
      const a = Math.max(s0, r.startMs)
      const b = Math.min(s1, r.endMs)
      if (b - a >= VIDEO_REVERSE_MIN_MS && b - a <= REVERSE_MAX_MS) out.push([a, b])
    }
  }
  out.sort((p, q) => p[0] - q[0] || p[1] - q[1])
  return out
}

/** Frame-quantized reversed source ms at `srcMs`, or null outside a piece (matches reversedMediaTime). */
export function reversedSourceMs(edits: ClipEditsV2, srcMs: number): number | null {
  for (const [a, b] of reversePieces(edits)) {
    if (srcMs >= a && srcMs < b) {
      const localMs = srcMs - a
      const ownMs = b - a
      const k = Math.floor((Math.max(0, localMs) * 30) / 1000)
      return Math.max(a, a + ownMs - ((k + 1) * 1000) / 30)
    }
  }
  return null
}

export function itemReversed(edits: ClipEditsV2, srcIn: number, srcOut: number): boolean {
  const a = Math.round(srcIn)
  const b = Math.round(srcOut)
  return (edits.videoReverse ?? []).some((r) => r.startMs <= a + 1 && r.endMs >= b - 1)
}

function subtractRange(list: VideoReverseRange[] | undefined, fromMs: number, toMs: number): VideoReverseRange[] | undefined {
  const a = Math.round(fromMs)
  const b = Math.round(toMs)
  const rest: VideoReverseRange[] = []
  for (const r of list ?? []) {
    if (r.endMs <= a || r.startMs >= b) {
      rest.push(r)
      continue
    }
    if (r.startMs < a) rest.push({ startMs: r.startMs, endMs: a })
    if (r.endMs > b) rest.push({ startMs: b, endMs: r.endMs })
  }
  return normalizeVideoReverse(rest)
}

export function toggleItemReverse(edits: ClipEditsV2, srcIn: number, srcOut: number): ClipEditsV2 {
  const a = Math.round(srcIn)
  const b = Math.round(srcOut)
  if (b - a < VIDEO_REVERSE_MIN_MS) return edits
  if (b - a > REVERSE_MAX_MS) return edits
  if (itemReversed(edits, a, b)) {
    return { ...edits, videoReverse: subtractRange(edits.videoReverse, a, b) }
  }
  return { ...edits, videoReverse: normalizeVideoReverse([...(edits.videoReverse ?? []), { startMs: a, endMs: b }]) }
}
