import { createHash } from 'crypto'

export type CutRange = [number, number]

export type ClipEditsV2 = {
  v: 2
  trim: { in: number; out: number }
  cutRanges: CutRange[]
  wordFixes: Record<string, string>
  captions: {
    enabled?: boolean
    presetId?: string
    animation?: string
    size?: number
    position?: string
    case?: string
    wordsPerLine?: number
  }
  layout: {
    mode: 'speaker_follow' | 'fit_blur' | 'center_crop' | 'subject_follow'
    shotOverrides: { i: number; focus: 'auto' | 'A' | 'B' | 'both' }[]
  }
  broll?: unknown[]
  music?: unknown
  sfx?: unknown[]
  audioTrack?: string
  brand?: unknown
}

export function defaultEdits(clipDurationMs: number): ClipEditsV2 {
  return {
    v: 2,
    trim: { in: 0, out: clipDurationMs },
    cutRanges: [],
    wordFixes: {},
    captions: { enabled: true, presetId: 'bold_pop', animation: 'pop', size: 1, position: 'bottom', case: 'sentence', wordsPerLine: 2 },
    layout: { mode: 'speaker_follow', shotOverrides: [] },
  }
}

export function normalizeEdits(raw: unknown, clipDurationMs: number): ClipEditsV2 {
  const base = defaultEdits(clipDurationMs)
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const trim = (o.trim as { in?: number; out?: number }) || {}
  return {
    ...base,
    ...o,
    v: 2,
    trim: {
      in: Math.max(0, Number(trim.in ?? base.trim.in)),
      out: Math.min(clipDurationMs, Number(trim.out ?? base.trim.out)),
    },
    cutRanges: Array.isArray(o.cutRanges) ? (o.cutRanges as CutRange[]) : [],
    wordFixes: (o.wordFixes as Record<string, string>) || {},
    captions: { ...base.captions, ...(o.captions as object) },
    layout: {
      ...base.layout,
      ...((o.layout as object) || {}),
      shotOverrides: Array.isArray((o.layout as { shotOverrides?: unknown })?.shotOverrides)
        ? ((o.layout as { shotOverrides: ClipEditsV2['layout']['shotOverrides'] }).shotOverrides)
        : [],
    },
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(o).sort()) out[k] = sortJson(o[k])
    return out
  }
  return value
}

export function canonicalEditsJson(edits: ClipEditsV2): string {
  return JSON.stringify(sortJson(edits))
}

export function editsVersionHash(edits: ClipEditsV2): string {
  return createHash('sha256').update(canonicalEditsJson(edits)).digest('hex')
}

export function isDefaultEdits(edits: ClipEditsV2, clipDurationMs: number): boolean {
  const d = defaultEdits(clipDurationMs)
  return (
    edits.trim.in === d.trim.in &&
    edits.trim.out === d.trim.out &&
    edits.cutRanges.length === 0 &&
    Object.keys(edits.wordFixes).length === 0 &&
    (edits.layout.shotOverrides?.length ?? 0) === 0
  )
}

export function keepSegments(trimIn: number, trimOut: number, cutRanges: CutRange[]): [number, number][] {
  const segs: [number, number][] = []
  let t = trimIn
  for (const [s, e] of [...cutRanges].sort((a, b) => a[0] - b[0])) {
    const cs = Math.max(s, trimIn)
    const ce = Math.min(e, trimOut)
    if (ce <= t) continue
    if (cs > t) segs.push([t, cs])
    t = Math.max(t, ce)
  }
  if (t < trimOut) segs.push([t, trimOut])
  return segs.filter(([a, b]) => b - a >= 80)
}

export function remapTime(t: number, segs: [number, number][]): number | null {
  let acc = 0
  for (const [a, b] of segs) {
    if (a <= t && t < b) return acc + (t - a)
    acc += b - a
  }
  return null
}

export type ClipWord = { w: string; s: number; e: number; p?: number; spk?: number }

export function applyWordFixes(words: ClipWord[], fixes: Record<string, string>): ClipWord[] {
  return words.map((w, i) => (fixes[String(i)] !== undefined ? { ...w, w: fixes[String(i)] } : w))
}

export function wordsAfterEdits(
  words: ClipWord[],
  edits: ClipEditsV2,
): { words: ClipWord[]; segs: [number, number][] } {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  const msWords = words.map((w) => ({ ...w, s: w.s * 1000, e: w.e * 1000 }))
  const out: ClipWord[] = []
  for (const w of msWords) {
    const mid = (w.s + w.e) / 2
    const mapped = remapTime(mid, segs)
    if (mapped === null) continue
    const seg = segs.find(([a, b]) => a <= mid && mid < b)
    if (!seg) continue
    const [a] = seg
    out.push({
      w: w.w,
      s: (mapped - (mid - w.s - a)) / 1000,
      e: (mapped + (w.e - mid)) / 1000,
      p: w.p,
      spk: w.spk,
    })
  }
  return { words: applyWordFixes(out, edits.wordFixes), segs }
}

export function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function buildSrt(words: ClipWord[]): string {
  const lines: string[] = []
  let i = 1
  for (const w of words) {
    if (!w.w.trim()) continue
    lines.push(String(i++))
    lines.push(`${formatSrtTime(w.s)} --> ${formatSrtTime(w.e)}`)
    lines.push(w.w)
    lines.push('')
  }
  return lines.join('\n')
}

export const FILLER_RE = /^(um+|uh+|erm|ah+)$/i
