import type { ReasonTag } from '@/lib/clips/reason-tag'
import type { Timebase } from '@/lib/clips/editor/clip-timeline'
import { sourceMsToEditorMs } from '@/lib/clips/editor/source-ms-to-editor'
import { formatTimecode } from '@/lib/clips/format'

export type HighlightPick = {
  clipId: string
  title: string
  startMs: number
  endMs: number
  score: number
  reasonTag: ReasonTag
  why: string | null
  origin?: 'find' | 'clip'
  findJobId?: string
}

export type HighlightRange = {
  pick: HighlightPick
  startMs: number
  endMs: number
}

export type VisualMomentRow = {
  beforeWordIndex: number
  pick: HighlightPick
  label: string
}

const MIN_PICK_MS = 3000

export function clampPickDrag(
  range: { startMs: number; endMs: number },
  edge: 'start' | 'end',
  ms: number,
  durationMs: number,
): { startMs: number; endMs: number } {
  const lo = 0
  const hi = Math.max(MIN_PICK_MS, durationMs)
  let startMs = range.startMs
  let endMs = range.endMs
  if (edge === 'start') {
    startMs = Math.max(lo, Math.min(ms, endMs - MIN_PICK_MS))
  } else {
    endMs = Math.min(hi, Math.max(ms, startMs + MIN_PICK_MS))
  }
  return { startMs, endMs }
}

export function picksToLaneRanges(
  picks: HighlightPick[],
  ranges: HighlightRange[],
  tb: Timebase,
): { pick: HighlightPick; startMs: number; endMs: number; wasCut: boolean }[] {
  const byId = new Map(ranges.map((r) => [r.pick.clipId, r]))
  const out: { pick: HighlightPick; startMs: number; endMs: number; wasCut: boolean }[] = []
  for (const pick of picks) {
    const r = byId.get(pick.clipId) ?? { pick, startMs: pick.startMs, endMs: pick.endMs }
    const a = sourceMsToEditorMs(tb, r.startMs)
    const b = sourceMsToEditorMs(tb, r.endMs)
    if (a.wasCut && b.wasCut && Math.abs(a.ms - b.ms) < 1) continue
    const startMs = Math.min(a.ms, b.ms)
    const endMs = Math.max(a.ms, b.ms)
    if (endMs - startMs < MIN_PICK_MS) continue
    out.push({ pick, startMs, endMs, wasCut: a.wasCut || b.wasCut })
  }
  return out
}

export function pickWordHighlight(
  words: { i: number; startMs: number; endMs: number }[],
  picks: HighlightPick[],
  ranges: HighlightRange[],
): Set<number> {
  const byId = new Map(ranges.map((r) => [r.pick.clipId, r]))
  const idx = new Set<number>()
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i]!
    const mid = (w.startMs + w.endMs) / 2
    for (const pick of picks) {
      const r = byId.get(pick.clipId) ?? pick
      if (mid >= r.startMs && mid <= r.endMs) idx.add(w.i)
    }
  }
  return idx
}

function truncate(s: string, max: number) {
  const t = s.trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export function visualMomentRows(
  words: { startMs: number; endMs: number }[],
  picks: HighlightPick[],
  ranges: HighlightRange[],
): VisualMomentRow[] {
  const byId = new Map(ranges.map((r) => [r.pick.clipId, r]))
  const rows: VisualMomentRow[] = []
  for (const pick of picks) {
    if (pick.reasonTag !== 'visual') {
      const r = byId.get(pick.clipId) ?? pick
      let count = 0
      for (const w of words) {
        const mid = (w.startMs + w.endMs) / 2
        if (mid >= r.startMs && mid <= r.endMs) count += 1
      }
      if (count >= 3) continue
    }
    const r = byId.get(pick.clipId) ?? pick
    const why = truncate(pick.why || pick.title, 80)
    const label = `▶ Visual moment · ${formatTimecode(r.startMs)}–${formatTimecode(r.endMs)} · ${why}`
    let beforeWordIndex = words.length
    for (let i = 0; i < words.length; i += 1) {
      const w = words[i]!
      if ((w.startMs + w.endMs) / 2 >= r.startMs) {
        beforeWordIndex = i
        break
      }
    }
    rows.push({ beforeWordIndex, pick, label })
  }
  rows.sort((a, b) => a.beforeWordIndex - b.beforeWordIndex || a.pick.startMs - b.pick.startMs)
  return rows
}

export function isPickMoved(pick: HighlightPick, range: { startMs: number; endMs: number }): boolean {
  return range.startMs !== pick.startMs || range.endMs !== pick.endMs
}

export function highlightRangesFromPicks(picks: HighlightPick[]): HighlightRange[] {
  return picks.map((pick) => ({ pick, startMs: pick.startMs, endMs: pick.endMs }))
}
