import type { ClipEditsV2 } from '@/lib/clips/edits'

export type LayoutSegment = {
  startMs: number
  endMs: number
  mode: ClipEditsV2['layout']['mode']
}

export function defaultLayoutSegments(trimIn: number, trimOut: number, mode: ClipEditsV2['layout']['mode']): LayoutSegment[] {
  return [{ startMs: trimIn, endMs: trimOut, mode }]
}

export function normalizeLayoutSegments(
  raw: unknown,
  trimIn: number,
  trimOut: number,
  fallbackMode: ClipEditsV2['layout']['mode'],
): LayoutSegment[] {
  if (!Array.isArray(raw) || !raw.length) {
    return defaultLayoutSegments(trimIn, trimOut, fallbackMode)
  }
  const modes = new Set<ClipEditsV2['layout']['mode']>([
    'speaker_follow',
    'fit_blur',
    'full_frame',
    'center_crop',
    'subject_follow',
    'split',
    'fill',
    'fit',
    'grid3',
    'grid4',
    'dynamic',
    'auto',
    'screen_pip',
  ])
  const segs: LayoutSegment[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as { startMs?: unknown; endMs?: unknown; mode?: unknown }
    const startMs = Math.round(Number(r.startMs))
    const endMs = Math.round(Number(r.endMs))
    const mode = modes.has(r.mode as ClipEditsV2['layout']['mode'])
      ? (r.mode as ClipEditsV2['layout']['mode'])
      : fallbackMode
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    segs.push({
      startMs: Math.max(trimIn, startMs),
      endMs: Math.min(trimOut, endMs),
      mode,
    })
  }
  if (!segs.length) return defaultLayoutSegments(trimIn, trimOut, fallbackMode)
  return mergeAdjacentSegments(segs.sort((a, b) => a.startMs - b.startMs))
}

function mergeAdjacentSegments(segs: LayoutSegment[]): LayoutSegment[] {
  const out: LayoutSegment[] = []
  for (const s of segs) {
    const prev = out[out.length - 1]
    if (prev && prev.mode === s.mode && prev.endMs >= s.startMs - 1) {
      prev.endMs = Math.max(prev.endMs, s.endMs)
    } else {
      out.push({ ...s })
    }
  }
  return out
}

export function layoutModeAtSourceMs(edits: ClipEditsV2, sourceMs: number): ClipEditsV2['layout']['mode'] {
  const segs = edits.layout.layoutSegments
  if (!segs?.length) return edits.layout.mode
  const hit = segs.find((s) => sourceMs >= s.startMs && sourceMs < s.endMs)
  return hit?.mode ?? edits.layout.mode
}

export function splitLayoutSegmentAt(edits: ClipEditsV2, sourceMs: number): ClipEditsV2 {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const segs = normalizeLayoutSegments(edits.layout.layoutSegments, trimIn, trimOut, edits.layout.mode)
  const ms = Math.round(sourceMs)
  const idx = segs.findIndex((s) => ms > s.startMs + 200 && ms < s.endMs - 200)
  if (idx < 0) return edits
  const s = segs[idx]
  const left = { startMs: s.startMs, endMs: ms, mode: s.mode }
  const right = { startMs: ms, endMs: s.endMs, mode: s.mode }
  const next = [...segs.slice(0, idx), left, right, ...segs.slice(idx + 1)]
  return { ...edits, layout: { ...edits.layout, layoutSegments: next } }
}

export function setLayoutModeForSegmentAt(edits: ClipEditsV2, sourceMs: number, mode: ClipEditsV2['layout']['mode']): ClipEditsV2 {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const segs = normalizeLayoutSegments(edits.layout.layoutSegments, trimIn, trimOut, edits.layout.mode)
  const ms = Math.round(sourceMs)
  const idx = segs.findIndex((s) => ms >= s.startMs && ms < s.endMs)
  if (idx < 0) return { ...edits, layout: { ...edits.layout, mode, layoutSegments: defaultLayoutSegments(trimIn, trimOut, mode) } }
  const next = segs.map((s, i) => (i === idx ? { ...s, mode } : s))
  return { ...edits, layout: { ...edits.layout, layoutSegments: next } }
}

/** Remove the layout segment under the playhead (merge into neighbors). */
export function deleteLayoutSegmentAt(edits: ClipEditsV2, sourceMs: number): ClipEditsV2 {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const segs = normalizeLayoutSegments(edits.layout.layoutSegments, trimIn, trimOut, edits.layout.mode)
  if (segs.length <= 1) return edits
  const ms = Math.round(sourceMs)
  const idx = segs.findIndex((s) => ms >= s.startMs && ms < s.endMs)
  if (idx < 0) return edits
  const removed = segs[idx]
  const neighborMode = segs[idx - 1]?.mode ?? segs[idx + 1]?.mode ?? edits.layout.mode
  const merged: LayoutSegment = {
    startMs: removed.startMs,
    endMs: removed.endMs,
    mode: neighborMode,
  }
  const without = [...segs.slice(0, idx), ...segs.slice(idx + 1)]
  without.splice(idx, 0, merged)
  return {
    ...edits,
    layout: { ...edits.layout, layoutSegments: mergeAdjacentSegments(without) },
  }
}

/** Dominant layout mode by overlap on the trim window (export fallback). */
export function cutRangeForLayoutSegmentAt(edits: ClipEditsV2, sourceMs: number): [number, number] | null {
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  const segs = normalizeLayoutSegments(edits.layout.layoutSegments, trimIn, trimOut, edits.layout.mode)
  const ms = Math.round(sourceMs)
  const seg = segs.find((s) => ms >= s.startMs && ms < s.endMs)
  if (!seg) return null
  return [seg.startMs, seg.endMs]
}

export function dominantLayoutModeForTrim(edits: ClipEditsV2): ClipEditsV2['layout']['mode'] {
  const segs = edits.layout.layoutSegments
  if (!segs?.length) return edits.layout.mode
  const trimIn = edits.trim.in
  const trimOut = edits.trim.out
  let best = edits.layout.mode
  let bestMs = 0
  for (const s of segs) {
    const a = Math.max(trimIn, s.startMs)
    const b = Math.min(trimOut, s.endMs)
    const len = Math.max(0, b - a)
    if (len > bestMs) {
      bestMs = len
      best = s.mode
    }
  }
  return best
}
