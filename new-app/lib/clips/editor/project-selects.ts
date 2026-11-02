/**
 * Q5 TB-12: per-project speech-search selects bin + assemble rough cut (0.5 s handles).
 */
import type { ClipEditsV2, CutRange } from '@/lib/clips/edits'
import { mergeCutRanges } from '@/lib/clips/edits'
import type { SpeechSearchHit } from '@/lib/clips/editor/speech-search'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { insertMediaAt } from '@/lib/clips/editor/media-add'

export const SELECT_HANDLE_MS = 500

export type ProjectSelectRow = {
  id: string
  sourceId: string
  kind: string
  label: string
  startMs: number
  endMs: number
  snippet: string | null
  sortOrder: number
}

export function hitToSelectPayload(hit: SpeechSearchHit): Omit<ProjectSelectRow, 'id' | 'sortOrder'> {
  const startMs = Math.round(hit.startS * 1000)
  const endMs = Math.max(startMs + 300, Math.round(hit.endS * 1000))
  return {
    sourceId: hit.sourceId,
    kind: hit.kind,
    label: hit.label,
    startMs,
    endMs,
    snippet: hit.snippet,
  }
}

export function selectKey(row: Pick<ProjectSelectRow, 'sourceId' | 'startMs' | 'endMs'>): string {
  return `${row.sourceId}:${row.startMs}:${row.endMs}`
}

function blockWithHandles(startMs: number, endMs: number, maxMs?: number): CutRange {
  const lo = Math.max(0, startMs - SELECT_HANDLE_MS)
  const hi = Math.min(maxMs ?? Number.MAX_SAFE_INTEGER, endMs + SELECT_HANDLE_MS)
  return [lo, Math.max(lo + 300, hi)]
}

/** Main-source selects → trim + cuts or sectionOrder (bin order). One undo step at caller. */
export function assembleMainSelects(
  edits: ClipEditsV2,
  selects: readonly ProjectSelectRow[],
  opts?: { sourceDurationMs?: number },
): ClipEditsV2 | null {
  const main = selects.filter((s) => s.kind === 'main')
  if (!main.length) return null
  const blocks = main.map((s) => blockWithHandles(s.startMs, s.endMs, opts?.sourceDurationMs))
  const trimIn = Math.min(...blocks.map((b) => b[0]))
  const trimOut = Math.max(...blocks.map((b) => b[1]))
  if (trimOut - trimIn < 500) return null

  const sortedByTime = [...blocks].sort((a, b) => a[0] - b[0])
  const binMatchesTime = blocks.every(
    (b, i) => b[0] === sortedByTime[i]![0] && b[1] === sortedByTime[i]![1],
  )

  if (binMatchesTime) {
    const cuts: CutRange[] = []
    for (let i = 0; i < blocks.length - 1; i++) {
      const gapStart = blocks[i]![1]
      const gapEnd = blocks[i + 1]![0]
      if (gapEnd - gapStart >= 80) cuts.push([gapStart, gapEnd])
    }
    return {
      ...edits,
      trim: { in: trimIn, out: trimOut },
      cutRanges: mergeCutRanges([...edits.cutRanges, ...cuts]),
      sectionOrder: undefined,
    }
  }

  return {
    ...edits,
    trim: { in: trimIn, out: trimOut },
    cutRanges: [],
    sectionOrder: blocks,
  }
}

/** Non-main selects append as ripple inserts in bin order (after main assemble). */
export function appendMediaSelectInserts(
  edits: ClipEditsV2,
  selects: readonly ProjectSelectRow[],
  mediaItems: readonly ProjectMediaItem[],
  newId: () => string,
): ClipEditsV2 {
  let next = edits
  const extras = selects.filter((s) => s.kind !== 'main')
  for (const sel of extras) {
    const item = mediaItems.find((m) => `${m.ref}:${m.refId}` === sel.sourceId)
    if (!item) continue
    const spanMs = Math.max(500, sel.endMs - sel.startMs + SELECT_HANDLE_MS * 2)
    const res = insertMediaAt(next, item, next.trim.out, 'append', newId, spanMs)
    if (res.edits) next = res.edits
  }
  return next
}

export function assembleSelectsOnEdits(
  edits: ClipEditsV2,
  selects: readonly ProjectSelectRow[],
  mediaItems: readonly ProjectMediaItem[],
  newId: () => string,
  opts?: { sourceDurationMs?: number },
): { edits: ClipEditsV2; label: string } | null {
  if (!selects.length) return null
  const main = assembleMainSelects(edits, selects, opts)
  if (!main && !selects.some((s) => s.kind !== 'main')) return null
  let next = main ?? { ...edits }
  next = appendMediaSelectInserts(next, selects, mediaItems, newId)
  const n = selects.length
  return { edits: next, label: `Assembled ${n} select${n === 1 ? '' : 's'} (0.5 s handles)` }
}
