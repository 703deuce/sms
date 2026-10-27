import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import type { EdlSegment, ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export type TimelineWordChip = {
  wordId: string
  text: string
  outStartMs: number
  outEndMs: number
  deleted: boolean
}

export type TimelineGapChip = {
  durMs: number
  outStartMs: number
  outEndMs: number
}

export type TimelineClip = {
  key: string
  kind: 'source' | 'gap'
  outStartMs: number
  outEndMs: number
  srcInMs?: number
  srcOutMs?: number
}

const MIN_CHIP_PX = 6
const GROUP_PX = 28

export function buildWordChips(
  document: ScriptDocumentV1,
  orderedWords: EditorWord[],
  edl: EdlSegment[],
  deletedSet: Set<string>,
): TimelineWordChip[] {
  const chips: TimelineWordChip[] = []
  for (const w of orderedWords) {
    const outStart = sourceMsToOutputTime(w.t0Ms, edl)
    const outEnd = sourceMsToOutputTime(w.t1Ms, edl)
    if (outStart == null || outEnd == null) {
      if (deletedSet.has(w.id)) continue
      chips.push({
        wordId: w.id,
        text: w.text,
        outStartMs: 0,
        outEndMs: 1,
        deleted: false,
      })
      continue
    }
    chips.push({
      wordId: w.id,
      text: w.text,
      outStartMs: outStart,
      outEndMs: Math.max(outStart + 1, outEnd),
      deleted: deletedSet.has(w.id),
    })
  }
  return chips.filter((c) => !c.deleted)
}

export function buildGapChips(edl: EdlSegment[]): TimelineGapChip[] {
  return edl
    .filter((s): s is EdlSegment & { kind: 'gap' } => s.kind === 'gap')
    .map((g) => ({
      durMs: g.durMs,
      outStartMs: g.outInMs,
      outEndMs: g.outInMs + g.durMs,
    }))
}

export function timelineClipsFromEdl(edl: EdlSegment[], splitAtOutMs: number[]): TimelineClip[] {
  const clips: TimelineClip[] = []
  for (const seg of edl) {
    if (seg.kind === 'gap') {
      clips.push({
        key: `gap-${seg.outInMs}`,
        kind: 'gap',
        outStartMs: seg.outInMs,
        outEndMs: seg.outInMs + seg.durMs,
      })
      continue
    }
    const splits = splitAtOutMs.filter((ms) => ms > seg.outInMs + 2 && ms < seg.outOutMs - 2).sort((a, b) => a - b)
    let cursor = seg.outInMs
    const boundaries = [...splits, seg.outOutMs]
    for (const end of boundaries) {
      if (end <= cursor + 1) continue
      const frac0 = (cursor - seg.outInMs) / Math.max(1, seg.outOutMs - seg.outInMs)
      const frac1 = (end - seg.outInMs) / Math.max(1, seg.outOutMs - seg.outInMs)
      const srcIn = seg.srcInMs + frac0 * (seg.srcOutMs - seg.srcInMs)
      const srcOut = seg.srcInMs + frac1 * (seg.srcOutMs - seg.srcInMs)
      clips.push({
        key: `src-${cursor}-${end}`,
        kind: 'source',
        outStartMs: cursor,
        outEndMs: end,
        srcInMs: srcIn,
        srcOutMs: srcOut,
      })
      cursor = end
    }
  }
  return clips
}

export type WordbarItem =
  | { kind: 'word'; wordId: string; text: string; outStartMs: number; outEndMs: number }
  | { kind: 'group'; label: string; outStartMs: number; outEndMs: number; wordIds: string[] }
  | { kind: 'gap'; label: string; outStartMs: number; outEndMs: number }

export function groupWordbarItems(chips: TimelineWordChip[], pxPerMs: number): WordbarItem[] {
  const items: WordbarItem[] = []
  let group: TimelineWordChip[] = []

  const flushGroup = () => {
    if (!group.length) return
    if (group.length === 1) {
      const w = group[0]
      items.push({
        kind: 'word',
        wordId: w.wordId,
        text: w.text,
        outStartMs: w.outStartMs,
        outEndMs: w.outEndMs,
      })
    } else {
      items.push({
        kind: 'group',
        label: '…',
        outStartMs: group[0].outStartMs,
        outEndMs: group[group.length - 1].outEndMs,
        wordIds: group.map((g) => g.wordId),
      })
    }
    group = []
  }

  for (const chip of chips) {
    const widthPx = (chip.outEndMs - chip.outStartMs) * pxPerMs
    if (widthPx < MIN_CHIP_PX) {
      group.push(chip)
      const groupWidth = (group[group.length - 1].outEndMs - group[0].outStartMs) * pxPerMs
      if (groupWidth >= GROUP_PX) flushGroup()
    } else {
      flushGroup()
      items.push({
        kind: 'word',
        wordId: chip.wordId,
        text: chip.text,
        outStartMs: chip.outStartMs,
        outEndMs: chip.outEndMs,
      })
    }
  }
  flushGroup()
  return items
}

export function wordIndicesInOutputRange(
  chips: TimelineWordChip[],
  orderedWords: EditorWord[],
  outLo: number,
  outHi: number,
): { lo: number; hi: number } | null {
  const lo = Math.min(outLo, outHi)
  const hi = Math.max(outLo, outHi)
  let minIdx: number | null = null
  let maxIdx: number | null = null
  for (const chip of chips) {
    if (chip.outEndMs < lo || chip.outStartMs > hi) continue
    const idx = orderedWords.findIndex((w) => w.id === chip.wordId)
    if (idx < 0) continue
    minIdx = minIdx == null ? idx : Math.min(minIdx, idx)
    maxIdx = maxIdx == null ? idx : Math.max(maxIdx, idx)
  }
  if (minIdx == null || maxIdx == null) return null
  return { lo: minIdx, hi: maxIdx }
}

export function outputRangeForWordIndices(
  chips: TimelineWordChip[],
  orderedWords: EditorWord[],
  lo: number,
  hi: number,
): { outLo: number; outHi: number } | null {
  let outLo = Infinity
  let outHi = -Infinity
  for (let i = lo; i <= hi; i++) {
    const w = orderedWords[i]
    if (!w) continue
    const chip = chips.find((c) => c.wordId === w.id)
    if (!chip) continue
    outLo = Math.min(outLo, chip.outStartMs)
    outHi = Math.max(outHi, chip.outEndMs)
  }
  if (!Number.isFinite(outLo)) return null
  return { outLo, outHi }
}

export function splitMarkerAfterWordIndex(
  document: ScriptDocumentV1,
  orderedWords: EditorWord[],
  edl: EdlSegment[],
  outMs: number,
): number | null {
  const splits = document.splitAtOutMs ?? []
  for (const ms of splits) {
    if (Math.abs(ms - outMs) > 4) continue
    for (let i = 0; i < orderedWords.length - 1; i++) {
      const a = orderedWords[i]
      const b = orderedWords[i + 1]
      const outA = sourceMsToOutputTime(a.t1Ms, edl)
      const outB = sourceMsToOutputTime(b.t0Ms, edl)
      if (outA != null && outB != null && ms >= outA - 2 && ms <= outB + 2) return i
    }
  }
  return null
}
