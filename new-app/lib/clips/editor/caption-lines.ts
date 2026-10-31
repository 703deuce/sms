/**
 * G3a: manual caption lines — typed, imported from SRT / VTT, or converted from the auto captions.
 *
 * `edits.captionLines` = [{ id, text, startMs, endMs }] in OUTPUT ms (like text items). When set they
 * replace the transcript words in the burned captions only; the caption style, animation and safe
 * area are unchanged. Words are time-sliced by length and tagged with their line (`ln`) so the ASS
 * builder shows exactly one caption per line. Mirror of worker/clips_worker/caption_lines.py.
 *
 * No React imports (lib/clips/edits.ts uses it).
 */
import { pyRound } from '@/lib/clips/render-plan/py'

export type CaptionLine = { id: string; text: string; startMs: number; endMs: number }

export const CAPTION_LINE_ID_BASE = 1_000_000
export const CAPTION_LINES_MAX = 2000
export const CAPTION_LINE_MAX_CHARS = 200
export const CAPTION_LINE_MIN_MS = 100

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const cpLen = (s: string) => Array.from(s).length

export function captionLineWordsOf(text: string): string[] {
  return text.replace(/\r/g, '').replace(/\n/g, ' ').replace(/\t/g, ' ').split(' ').filter(Boolean)
}

/** Valid lines sorted by start, overlaps trimmed (py normalize_caption_lines). */
export function normalizeCaptionLines(raw: unknown): CaptionLine[] {
  if (!Array.isArray(raw)) return []
  const rows: CaptionLine[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue
    const o = r as Record<string, unknown>
    const text = Array.from(captionLineWordsOf(String(o.text ?? '')).join(' ')).slice(0, CAPTION_LINE_MAX_CHARS).join('')
    const a0 = num(o.startMs)
    const b0 = num(o.endMs)
    if (!text || a0 === null || b0 === null) continue
    const a = Math.max(0, pyRound(a0))
    const b = pyRound(b0)
    if (b - a < CAPTION_LINE_MIN_MS) continue
    rows.push({ id: String(o.id ?? ''), text, startMs: a, endMs: b })
    if (rows.length >= CAPTION_LINES_MAX) break
  }
  rows.sort((p, q) => p.startMs - q.startMs || p.endMs - q.endMs)
  const out: CaptionLine[] = []
  let prevEnd = 0
  for (const x of rows) {
    const s = Math.max(x.startMs, prevEnd)
    if (x.endMs - s < CAPTION_LINE_MIN_MS) continue
    out.push({ ...x, startMs: s })
    prevEnd = x.endMs
  }
  return out
}

const ID_RE = /^[A-Za-z0-9_~-]{1,64}$/

/** Edits normalizer: same lines + stable unique ids; undefined when empty (key dropped). */
export function normalizeCaptionLinesEdits(raw: unknown): CaptionLine[] | undefined {
  const lines = normalizeCaptionLines(raw)
  if (!lines.length) return undefined
  const seen = new Set<string>()
  return lines.map((l, i) => {
    let id = ID_RE.test(l.id) && !seen.has(l.id) ? l.id : `cl${i}_${l.startMs}`
    while (seen.has(id)) id = `${id}x`
    seen.add(id)
    return { ...l, id }
  })
}

export type CaptionLineWord = { i: number; text: string; s_ms: number; e_ms: number; ln: number }

/** Caption words (output ms) for the lines — py caption_line_words. */
export function captionLineWords(lines: unknown): CaptionLineWord[] {
  const out: CaptionLineWord[] = []
  normalizeCaptionLines(lines).forEach((line, li) => {
    const words = captionLineWordsOf(line.text)
    const total = words.reduce((n, w) => n + cpLen(w) + 1, 0)
    const s = line.startMs
    const dur = line.endMs - s
    let acc = 0
    words.forEach((w, wi) => {
      const ws = s + Math.floor((dur * acc) / total)
      acc += cpLen(w) + 1
      let we = s + Math.floor((dur * acc) / total)
      if (we <= ws) we = ws + 1
      out.push({ i: CAPTION_LINE_ID_BASE + li * 1000 + wi, text: w, s_ms: ws, e_ms: we, ln: li })
    })
  })
  return out
}

/** Render words (seconds) for the caption ASS — captionWordsToClipWords shape + `ln`. */
export function captionLineClipWords(lines: unknown): { w: string; s: number; e: number; i: number; idx: number; ln: number }[] {
  return captionLineWords(lines).map((c) => ({ w: c.text, s: c.s_ms / 1000, e: c.e_ms / 1000, i: c.i, idx: c.i, ln: c.ln }))
}

// ---- editing helpers (panel + Captions lane) ---------------------------------------------------

let idSeq = 0
export const newCaptionLineId = () => `cl${Date.now().toString(36)}${(idSeq++).toString(36)}`

/** Reading-speed length for a typed line: ~15 characters / s, 0.8 s – 6 s. */
export function readingMs(text: string): number {
  return Math.max(800, Math.min(6000, Math.round((cpLen(text.trim()) * 1000) / 15)))
}

/**
 * Typed lines (one per row of `text`) placed back to back from `atMs`, each as long as it takes to
 * read, never overlapping the next existing line and never past `durationMs`.
 */
export function addTypedLines(lines: CaptionLine[], text: string, atMs: number, durationMs: number): CaptionLine[] {
  const rows = text.split('\n').map((r) => captionLineWordsOf(r).join(' ')).filter(Boolean)
  const next = [...lines]
  let t = Math.max(0, Math.round(atMs))
  for (const row of rows) {
    const inside = next.find((l) => l.startMs <= t && t < l.endMs)
    if (inside) t = inside.endMs
    if (t + CAPTION_LINE_MIN_MS > durationMs) break
    const after = next.filter((l) => l.startMs >= t).sort((a, b) => a.startMs - b.startMs)[0]
    const end = Math.min(t + readingMs(row), durationMs, after ? after.startMs : Infinity)
    if (end - t < CAPTION_LINE_MIN_MS) {
      t = after ? after.endMs : durationMs
      continue
    }
    next.push({ id: newCaptionLineId(), text: row, startMs: t, endMs: end })
    t = end
  }
  return normalizeCaptionLinesEdits(next) ?? []
}

/** Split one line into two: at a character index of its text, else at `atMs`, else in the middle. */
export function splitCaptionLine(lines: CaptionLine[], id: string, at: { charIndex?: number; ms?: number } = {}): CaptionLine[] {
  const l = lines.find((x) => x.id === id)
  if (!l) return lines
  const words = captionLineWordsOf(l.text)
  if (words.length < 2) return lines
  const dur = l.endMs - l.startMs
  let k: number
  if (at.charIndex !== undefined) {
    // words fully before the caret go left
    let pos = 0
    k = 0
    for (const w of words) {
      if (pos + w.length > at.charIndex) break
      pos += w.length + 1
      k++
    }
  } else if (at.ms !== undefined && at.ms > l.startMs && at.ms < l.endMs) {
    const total = words.reduce((n, w) => n + cpLen(w) + 1, 0)
    const want = ((at.ms - l.startMs) / dur) * total
    let acc = 0
    k = 0
    for (const w of words) {
      if (acc + (cpLen(w) + 1) / 2 > want) break
      acc += cpLen(w) + 1
      k++
    }
  } else k = Math.ceil(words.length / 2)
  k = Math.max(1, Math.min(words.length - 1, k))
  const left = words.slice(0, k).join(' ')
  const right = words.slice(k).join(' ')
  let cut: number
  if (at.ms !== undefined && at.charIndex === undefined && at.ms > l.startMs && at.ms < l.endMs) cut = Math.round(at.ms)
  else cut = l.startMs + Math.round((dur * (cpLen(left) + 1)) / (cpLen(l.text) + 1))
  cut = Math.max(l.startMs + CAPTION_LINE_MIN_MS, Math.min(l.endMs - CAPTION_LINE_MIN_MS, cut))
  if (cut - l.startMs < CAPTION_LINE_MIN_MS || l.endMs - cut < CAPTION_LINE_MIN_MS) return lines
  const out: CaptionLine[] = []
  for (const x of lines) {
    if (x.id !== id) out.push(x)
    else out.push({ ...x, text: left, endMs: cut }, { id: newCaptionLineId(), text: right, startMs: cut, endMs: x.endMs })
  }
  return out
}

/** Merge a line with the next one (text joined, spans both). */
export function mergeCaptionLineWithNext(lines: CaptionLine[], id: string): CaptionLine[] {
  const sorted = [...lines].sort((a, b) => a.startMs - b.startMs)
  const i = sorted.findIndex((x) => x.id === id)
  if (i < 0 || i + 1 >= sorted.length) return lines
  const a = sorted[i]!
  const b = sorted[i + 1]!
  const text = Array.from(`${a.text} ${b.text}`).slice(0, CAPTION_LINE_MAX_CHARS).join('')
  return [...sorted.slice(0, i), { ...a, text, endMs: Math.max(a.endMs, b.endMs) }, ...sorted.slice(i + 2)]
}

/** Auto captions → editable lines: same chunks the burned captions use (wordsPerLine). */
export function captionLinesFromWords(words: { text: string; s_ms: number; e_ms: number }[], wordsPerLine: number): CaptionLine[] {
  const wpl = Math.max(1, Math.round(wordsPerLine) || 1)
  const out: CaptionLine[] = []
  for (let k = 0; k < words.length; k += wpl) {
    const chunk = words.slice(k, k + wpl)
    const nextStart = words[k + wpl]?.s_ms
    const start = chunk[0]!.s_ms
    let end = chunk[chunk.length - 1]!.e_ms
    if (nextStart !== undefined) end = Math.min(Math.max(end, start + CAPTION_LINE_MIN_MS), nextStart)
    else end = Math.max(end, start + CAPTION_LINE_MIN_MS)
    out.push({ id: `cl${out.length}_${start}`, text: chunk.map((w) => String(w.text).trim()).filter(Boolean).join(' '), startMs: start, endMs: end })
  }
  return normalizeCaptionLinesEdits(out) ?? []
}

// ---- subtitle files ------------------------------------------------------------------------------

const TIME = String.raw`(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})`
const CUE_RE = new RegExp(`^\\s*${TIME}\\s*-->\\s*${TIME}`)

function toMs(h: string | undefined, m: string, s: string, f: string): number {
  return ((Number(h ?? 0) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(f.padEnd(3, '0'))
}

/** Parse SRT or WebVTT text (tags stripped, multi-line cues joined) into caption lines. */
export function parseSubtitles(src: string, opts: { offsetMs?: number; durationMs?: number } = {}): CaptionLine[] {
  const off = opts.offsetMs ?? 0
  const lim = opts.durationMs ?? Infinity
  const rows = src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const out: CaptionLine[] = []
  for (let i = 0; i < rows.length; i++) {
    const m = CUE_RE.exec(rows[i]!)
    if (!m) continue
    const a = toMs(m[1], m[2]!, m[3]!, m[4]!) + off
    let b = toMs(m[5], m[6]!, m[7]!, m[8]!) + off
    const text: string[] = []
    while (i + 1 < rows.length && rows[i + 1]!.trim() !== '') {
      i++
      if (CUE_RE.test(rows[i]!)) {
        i--
        break
      }
      text.push(rows[i]!)
    }
    const t = captionLineWordsOf(text.join(' ').replace(/<[^>]*>/g, '').replace(/\{\\[^}]*\}/g, '')).join(' ')
    if (!t || a >= lim) continue
    b = Math.min(b, lim)
    out.push({ id: `cl${out.length}_${a}`, text: t, startMs: a, endMs: b })
  }
  return normalizeCaptionLinesEdits(out) ?? []
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
function stamp(ms: number, sep: ',' | '.'): string {
  const t = Math.max(0, Math.round(ms))
  return `${pad(Math.floor(t / 3_600_000))}:${pad(Math.floor(t / 60_000) % 60)}:${pad(Math.floor(t / 1000) % 60)}${sep}${pad(t % 1000, 3)}`
}

export function captionLinesToSrt(lines: CaptionLine[]): string {
  return normalizeCaptionLines(lines).map((l, i) => `${i + 1}\n${stamp(l.startMs, ',')} --> ${stamp(l.endMs, ',')}\n${l.text}\n`).join('\n')
}

export function captionLinesToVtt(lines: CaptionLine[]): string {
  return `WEBVTT\n\n${normalizeCaptionLines(lines).map((l) => `${stamp(l.startMs, '.')} --> ${stamp(l.endMs, '.')}\n${l.text}\n`).join('\n')}`
}

export function captionLinesToTxt(lines: CaptionLine[]): string {
  return normalizeCaptionLines(lines).map((l) => l.text).join('\n') + '\n'
}
