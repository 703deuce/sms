import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import type { EdlSegment, ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export const DEFAULT_EDL_PAD_MS = 80

export function buildDocumentFromDeletes(
  allWords: EditorWord[],
  deletedWordIds: Set<string>,
): ScriptDocumentV1 {
  const keptWordIds: string[] = []
  const deleted: string[] = []
  for (const w of allWords) {
    if (deletedWordIds.has(w.id)) deleted.push(w.id)
    else keptWordIds.push(w.id)
  }
  return { v: 1, keptWordIds, deletedWordIds: deleted }
}

function padBeforeWord(document: ScriptDocumentV1, wordId: string, defaultPad: number): number {
  const custom = document.padBeforeMs?.[wordId]
  if (typeof custom === 'number' && custom >= 0) return custom
  return defaultPad
}

function gapsAfterWord(document: ScriptDocumentV1, wordId: string): { durMs: number }[] {
  const gaps = document.gapInserts ?? []
  return gaps.filter((g) => g.afterWordId === wordId).map((g) => ({ durMs: Math.max(1, g.durMs) }))
}

function gapsAtOutMs(document: ScriptDocumentV1, outMs: number, tolerance = 2): { durMs: number }[] {
  const gaps = document.gapInserts ?? []
  return gaps
    .filter((g) => typeof g.atOutMs === 'number' && Math.abs(g.atOutMs - outMs) <= tolerance)
    .map((g) => ({ durMs: Math.max(1, g.durMs) }))
}

/** Derive playback timeline from kept words (spec §B1 pad between words). */
export function deriveEdl(
  document: ScriptDocumentV1,
  wordsById: Map<string, EditorWord>,
  opts?: { padMs?: number },
): EdlSegment[] {
  const defaultPad = opts?.padMs ?? DEFAULT_EDL_PAD_MS
  const segments: EdlSegment[] = []
  let outMs = 0
  const kept = document.keptWordIds
    .map((id) => wordsById.get(id))
    .filter((w): w is EditorWord => Boolean(w))
    .sort((a, b) => a.t0Ms - b.t0Ms)

  const pushGap = (durMs: number, freezeSrcMs: number) => {
    segments.push({ kind: 'gap', durMs, freezeSrcMs, outInMs: outMs })
    outMs += durMs
  }

  for (let i = 0; i < kept.length; i++) {
    const w = kept[i]
    const prev = i > 0 ? kept[i - 1] : null
    const padBefore = prev ? padBeforeWord(document, w.id, defaultPad) : 0
    const srcInMs = Math.max(0, w.t0Ms - padBefore)
    const srcOutMs = w.t1Ms + defaultPad
    const dur = Math.max(1, srcOutMs - srcInMs)
    const outOutMs = outMs + dur
    segments.push({
      kind: 'source',
      srcInMs,
      srcOutMs,
      outInMs: outMs,
      outOutMs,
    })
    outMs = outOutMs

    for (const g of gapsAfterWord(document, w.id)) pushGap(g.durMs, w.t1Ms)
    for (const g of gapsAtOutMs(document, outMs)) pushGap(g.durMs, w.t1Ms)
  }

  return mergeAdjacentSource(segments)
}

function mergeAdjacentSource(segments: EdlSegment[]): EdlSegment[] {
  const out: EdlSegment[] = []
  for (const seg of segments) {
    if (seg.kind !== 'source') {
      out.push(seg)
      continue
    }
    const last = out[out.length - 1]
    if (last && last.kind === 'source' && last.srcOutMs >= seg.srcInMs - 1) {
      last.srcOutMs = Math.max(last.srcOutMs, seg.srcOutMs)
      last.outOutMs = seg.outOutMs
    } else {
      out.push({ ...seg })
    }
  }
  return out
}

export function outputTimeToSourceMs(tOut: number, edl: EdlSegment[]): number | null {
  for (const seg of edl) {
    if (seg.kind === 'gap') {
      const end = seg.outInMs + seg.durMs
      if (tOut >= seg.outInMs && tOut <= end) return seg.freezeSrcMs
      continue
    }
    if (tOut >= seg.outInMs && tOut <= seg.outOutMs) {
      const frac = (tOut - seg.outInMs) / Math.max(1, seg.outOutMs - seg.outInMs)
      return seg.srcInMs + frac * (seg.srcOutMs - seg.srcInMs)
    }
  }
  return null
}

export function sourceMsToOutputTime(tSrc: number, edl: EdlSegment[]): number | null {
  for (const seg of edl) {
    if (seg.kind === 'gap') continue
    if (tSrc >= seg.srcInMs && tSrc <= seg.srcOutMs) {
      const frac = (tSrc - seg.srcInMs) / Math.max(1, seg.srcOutMs - seg.srcInMs)
      return seg.outInMs + frac * (seg.outOutMs - seg.outInMs)
    }
  }
  return null
}
