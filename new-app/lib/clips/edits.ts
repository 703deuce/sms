import { createHash } from 'crypto'
import { normalizeAudioEdits, type ClipEditsAudio } from '@/lib/clips/audio'
import { normalizeBrollItems, type BrollItem } from '@/lib/clips/broll'

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
    colors?: { a?: string; b?: string }
    emphasis?: number[]
    keywordHighlight?: boolean
    autoEmojis?: boolean
    emojiByWord?: Record<string, string>
    progressBar?: {
      enabled?: boolean
      color?: string
      position?: 'top' | 'bottom'
      thickness?: number
    }
    presetConfig?: Record<string, unknown>
    customPresetId?: string
  }
  layout: {
    mode: 'speaker_follow' | 'fit_blur' | 'center_crop' | 'subject_follow'
    shotOverrides: { i: number; focus: 'auto' | 'A' | 'B' | 'both' }[]
  }
  broll?: BrollItem[]
  audio?: ClipEditsAudio
  thumbnailId?: string | null
  audioTrack?: string
  brand?: unknown
  zoom?: { enabled?: boolean; intensity?: number }
  silenceTrim?: { enabled?: boolean; minGapMs?: number; keepMs?: number }
  /** Integrated loudness target (LUFS) for export loudnorm. */
  loudnessLufs?: -14 | -16 | -18 | -23 | -24
}

export type ClipBounds = { clipStartMs: number; clipEndMs: number }

export function defaultEdits(bounds: ClipBounds): ClipEditsV2 {
  return {
    v: 2,
    trim: { in: bounds.clipStartMs, out: bounds.clipEndMs },
    cutRanges: [],
    wordFixes: {},
    captions: {
      enabled: true,
      presetId: 'bold_pop',
      animation: 'pop',
      size: 1,
      position: 'bottom',
      case: 'sentence',
      wordsPerLine: 2,
    },
    layout: { mode: 'speaker_follow', shotOverrides: [] },
  }
}

/** Migrate legacy clip-relative trim/cuts to absolute source ms. */
function migrateLegacyEdits(raw: Record<string, unknown>, bounds: ClipBounds): Record<string, unknown> {
  const clipLen = bounds.clipEndMs - bounds.clipStartMs
  const trim = (raw.trim as { in?: number; out?: number }) || {}
  const tin = Number(trim.in ?? 0)
  const tout = Number(trim.out ?? clipLen)
  const looksRelative = tout <= clipLen + 500 && tin < bounds.clipEndMs - bounds.clipStartMs
  if (!looksRelative) return raw
  const cutRanges = (raw.cutRanges as CutRange[]) || []
  return {
    ...raw,
    trim: { in: bounds.clipStartMs + tin, out: bounds.clipStartMs + tout },
    cutRanges: cutRanges.map(([a, b]) => [bounds.clipStartMs + a, bounds.clipStartMs + b] as CutRange),
  }
}

export function normalizeEdits(raw: unknown, bounds: ClipBounds): ClipEditsV2 {
  const base = defaultEdits(bounds)
  if (!raw || typeof raw !== 'object') return base
  const migrated = migrateLegacyEdits(raw as Record<string, unknown>, bounds)
  const o = migrated
  const trim = (o.trim as { in?: number; out?: number }) || {}
  return {
    ...base,
    ...o,
    v: 2,
    trim: {
      in: Math.max(0, Number(trim.in ?? base.trim.in)),
      out: Math.min(Number.MAX_SAFE_INTEGER, Number(trim.out ?? base.trim.out)),
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
    broll: normalizeBrollItems(o.broll, outputDurationMs({ ...base, ...o, v: 2 } as ClipEditsV2)),
    audio: normalizeAudioEdits(o.audio),
    zoom:
      o.zoom && typeof o.zoom === 'object'
        ? {
            enabled: Boolean((o.zoom as { enabled?: boolean }).enabled),
            intensity: Number((o.zoom as { intensity?: number }).intensity) || 1.15,
          }
        : undefined,
    silenceTrim:
      o.silenceTrim && typeof o.silenceTrim === 'object'
        ? {
            enabled: Boolean((o.silenceTrim as { enabled?: boolean }).enabled),
            minGapMs: Number((o.silenceTrim as { minGapMs?: number }).minGapMs) || 600,
            keepMs: Number((o.silenceTrim as { keepMs?: number }).keepMs) || 150,
          }
        : undefined,
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

export function isDefaultEdits(edits: ClipEditsV2, bounds: ClipBounds): boolean {
  const d = defaultEdits(bounds)
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

export function remapTime(tMs: number, segs: [number, number][]): number | null {
  let acc = 0
  for (const [a, b] of segs) {
    if (a <= tMs && tMs < b) return acc + (tMs - a)
    acc += b - a
  }
  return null
}

export function outputDurationMs(edits: ClipEditsV2): number {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  return segs.reduce((sum, [a, b]) => sum + (b - a), 0)
}

export type ClipWord = { w: string; s: number; e: number; p?: number; spk?: number; i?: number; idx?: number }

export function wordKey(w: ClipWord): number | undefined {
  if (w.i !== undefined) return w.i
  if (w.idx !== undefined) return w.idx
  return undefined
}

export function applyWordFixesByIndex<T extends ClipWord>(words: T[], fixes: Record<string, string>): T[] {
  return words.map((w) => {
    const key = wordKey(w)
    if (key !== undefined && fixes[String(key)] !== undefined) return { ...w, w: fixes[String(key)] }
    return w
  })
}

export function wordDisplayText(w: ClipWord, fixes: Record<string, string>): string {
  const key = wordKey(w)
  if (key !== undefined && fixes[String(key)] !== undefined) return fixes[String(key)]
  return w.w
}

export function isWordCut(w: ClipWord, cutRanges: CutRange[]): boolean {
  const mid = ((w.s + w.e) / 2) * 1000
  return cutRanges.some(([s, e]) => mid >= s && mid < e)
}

export function subtractRangeFromCuts(cutRanges: CutRange[], restore: CutRange): CutRange[] {
  const [rs, re] = restore
  const out: CutRange[] = []
  for (const [s, e] of cutRanges) {
    if (re <= s || rs >= e) {
      out.push([s, e])
      continue
    }
    if (rs > s) out.push([s, rs])
    if (re < e) out.push([re, e])
  }
  return out.filter(([a, b]) => b - a >= 40)
}

export function mergeCutRanges(cutRanges: CutRange[]): CutRange[] {
  const sorted = [...cutRanges].sort((a, b) => a[0] - b[0])
  const out: CutRange[] = []
  for (const [s, e] of sorted) {
    const prev = out[out.length - 1]
    if (prev && s <= prev[1]) prev[1] = Math.max(prev[1], e)
    else out.push([s, e])
  }
  return out
}

export function wordsAfterEdits(
  words: ClipWord[],
  edits: ClipEditsV2,
): { words: ClipWord[]; segs: [number, number][] } {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  const out: ClipWord[] = []
  for (const w of words) {
    const sMs = w.s * 1000
    const eMs = w.e * 1000
    const mid = (sMs + eMs) / 2
    const seg = segs.find(([a, b]) => a <= mid && mid < b)
    if (!seg) continue
    const [a, b] = seg
    const clampStart = Math.max(sMs, a)
    const clampEnd = Math.min(eMs, b)
    if (clampEnd - clampStart < 20) continue
    const outS = remapTime(clampStart, segs)
    const outE = remapTime(clampEnd, segs)
    if (outS === null || outE === null || outE <= outS) continue
    const text =
      w.idx !== undefined && edits.wordFixes[String(w.idx)] !== undefined
        ? edits.wordFixes[String(w.idx)]
        : w.w
    out.push({
      w: text,
      s: outS / 1000,
      e: outE / 1000,
      p: w.p,
      spk: w.spk,
      idx: w.idx,
    })
  }
  return { words: out, segs }
}

export function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function buildSrtFromCaptionWords(
  words: { text: string; s_ms: number; e_ms: number }[],
): string {
  const lines: string[] = []
  let n = 1
  for (const w of words) {
    if (!w.text.trim()) continue
    if (w.e_ms <= w.s_ms) continue
    lines.push(String(n++))
    lines.push(`${formatSrtTime(w.s_ms / 1000)} --> ${formatSrtTime(w.e_ms / 1000)}`)
    lines.push(w.text)
    lines.push('')
  }
  return lines.join('\n')
}

/** @deprecated use buildSrtFromCaptionWords(buildCaptionWords(...)) */
export function buildSrt(words: ClipWord[]): string {
  return buildSrtFromCaptionWords(
    words.map((w) => ({ text: w.w, s_ms: w.s * 1000, e_ms: w.e * 1000 })),
  )
}

export const FILLER_RE = /^(um+|uh+|erm|ah+)$/i

/** Clip-relative ms segments for ffmpeg on a clip-cut file. */
export function clipRelativeSegments(edits: ClipEditsV2, clipStartMs: number): [number, number][] {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  return segs.map(([a, b]) => [a - clipStartMs, b - clipStartMs])
}
