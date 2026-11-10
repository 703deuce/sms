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

/** G3afix: a cue keeps up to 3 of its own lines; extra lines join the last one. */
export const CAPTION_LINE_MAX_TEXT_LINES = 3

/** G3afix: one word of a caption line — `br` starts a new cue line, `it`/`bo` inside <i>/<b>. */
export type LineToken = { w: string; br: boolean; it: boolean; bo: boolean }

const OPEN: Record<string, 'it' | 'bo'> = { '<i>': 'it', '<b>': 'bo' }
const CLOSE: Record<string, 'it' | 'bo'> = { '</i>': 'it', '</b>': 'bo' }

/**
 * Words of a caption line (py caption_lines.line_tokens): "\n" separates the cue's lines; <i>/<b>
 * (any case) set the style of the words that START inside them (tags never split a word). Any
 * other text is literal.
 */
export function lineTokens(text: string): LineToken[] {
  const state = { it: false, bo: false }
  const out: LineToken[] = []
  let linesSeen = 1
  String(text ?? '').replace(/\r/g, '').split('\n').forEach((line, li) => {
    let br = li > 0 && out.length > 0
    let cur: LineToken | null = null
    let pos = 0
    while (pos < line.length) {
      const t3 = line.slice(pos, pos + 3).toLowerCase()
      const t4 = line.slice(pos, pos + 4).toLowerCase()
      if (OPEN[t3]) {
        state[OPEN[t3]!] = true
        pos += 3
        continue
      }
      if (CLOSE[t4]) {
        state[CLOSE[t4]!] = false
        pos += 4
        continue
      }
      const cp = line.codePointAt(pos)!
      const ch = String.fromCodePoint(cp)
      pos += ch.length
      if (ch === ' ' || ch === '\t') {
        cur = null
        continue
      }
      if (cur === null) {
        const nb = br && linesSeen < CAPTION_LINE_MAX_TEXT_LINES
        if (nb) linesSeen++
        cur = { w: '', br: nb, it: state.it, bo: state.bo }
        br = false
        out.push(cur)
      }
      cur.w += ch
    }
  })
  return out
}

/** Raw text offset just after each word (caret split). */
export function lineTokenEnds(text: string): number[] {
  const ends: number[] = []
  let base = 0
  String(text ?? '').replace(/\r/g, '').split('\n').forEach((line, li) => {
    if (li) base += 1
    let inWord = false
    let pos = 0
    while (pos < line.length) {
      const t3 = line.slice(pos, pos + 3).toLowerCase()
      const t4 = line.slice(pos, pos + 4).toLowerCase()
      if (OPEN[t3]) {
        pos += 3
        continue
      }
      if (CLOSE[t4]) {
        pos += 4
        continue
      }
      const ch = String.fromCodePoint(line.codePointAt(pos)!)
      pos += ch.length
      if (ch === ' ' || ch === '\t') {
        inWord = false
        continue
      }
      if (!inWord) ends.push(0)
      inWord = true
      ends[ends.length - 1] = base + pos
    }
    base += line.length
  })
  return ends
}

/** Canonical text for tokens (py serialize_tokens): cut after `maxChars` plain code points. */
export function serializeTokens(tokens: readonly LineToken[], maxChars?: number): string {
  let out = ''
  let it = false
  let bo = false
  let left = maxChars ?? 1 << 30
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]!
    if (left <= 0) break
    if (it && !t.it) {
      out += '</i>'
      it = false
    }
    if (bo && !t.bo) {
      out += '</b>'
      bo = false
    }
    if (k) {
      out += t.br ? '\n' : ' '
      left -= 1
      if (left <= 0) break
    }
    if (t.bo && !bo) {
      out += '<b>'
      bo = true
    }
    if (t.it && !it) {
      out += '<i>'
      it = true
    }
    const w = Array.from(t.w).slice(0, left)
    out += w.join('')
    left -= w.length
  }
  if (it) out += '</i>'
  if (bo) out += '</b>'
  return out
}

/** Visible characters plus separators, matching how serializeTokens counts `maxChars`. */
export function tokenSpanChars(tokens: readonly LineToken[]): number {
  if (!tokens.length) return 0
  return tokens.reduce((n, tok, i) => n + (i ? 1 : 0) + cpLen(tok.w), 0)
}

/**
 * Pack tokens into groups of at most `maxChars` visible characters.
 * Never drops a token. A single token longer than `maxChars` stays intact in its own group.
 */
export function splitTokensByMaxChars(tokens: readonly LineToken[], maxChars: number): LineToken[][] {
  const groups: LineToken[][] = []
  let current: LineToken[] = []
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    if (!current.length) {
      current = [{ ...tok, br: false }]
      continue
    }
    const next = [...current, tok]
    if (tokenSpanChars(next) > maxChars) {
      groups.push(current)
      current = [{ ...tok, br: false }]
    } else {
      current = next
    }
  }
  if (current.length) groups.push(current)
  return groups
}

function proportionalSpans(weights: readonly number[], startMs: number, endMs: number): { startMs: number; endMs: number }[] {
  const total = weights.reduce((sum, w) => sum + w, 0) || 1
  const dur = endMs - startMs
  const out: { startMs: number; endMs: number }[] = []
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    const s = startMs + Math.round((dur * acc) / total)
    acc += weights[i]!
    const e = i === weights.length - 1 ? endMs : startMs + Math.round((dur * acc) / total)
    out.push({ startMs: s, endMs: Math.max(e, s) })
  }
  return out
}

/** Plain words of a caption line (tags dropped). */
export function captionLineWordsOf(text: string): string[] {
  return lineTokens(text).map((t) => t.w)
}

/** Text without tags, cue lines kept (TXT export, reading time). */
export function captionLinePlainText(text: string): string {
  const segs: string[][] = []
  for (const t of lineTokens(text)) {
    if (!segs.length || t.br) segs.push([])
    segs[segs.length - 1]!.push(t.w)
  }
  return segs.map((x) => x.join(' ')).join('\n')
}

export type CaptionLineNormalizeReport = {
  droppedInvalid: number
  reordered: boolean
}

const captionLineNormalizeReports = new WeakMap<object, CaptionLineNormalizeReport>()

function attachCaptionLineNormalizeReport<T extends object>(
  value: T,
  report: CaptionLineNormalizeReport,
): T {
  captionLineNormalizeReports.set(value, report)
  return value
}

/** Survives normalizeEdits so the export warning can still see dropped / reordered cues. */
export function getCaptionLineNormalizeReport(
  lines: readonly CaptionLine[] | undefined,
): CaptionLineNormalizeReport | undefined {
  if (!lines) return undefined
  return captionLineNormalizeReports.get(lines)
}

function looksLikeCaptionCue(o: Record<string, unknown>): boolean {
  return 'startMs' in o || 'endMs' in o || 'text' in o || 'id' in o
}

export function normalizeCaptionLinesDetailed(raw: unknown): {
  lines: CaptionLine[]
  report: CaptionLineNormalizeReport
} {
  if (!Array.isArray(raw)) {
    const report = { droppedInvalid: 0, reordered: false }
    return { lines: attachCaptionLineNormalizeReport([], report), report }
  }
  const rows: CaptionLine[] = []
  let droppedInvalid = 0
  for (const r of raw) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue
    const o = r as Record<string, unknown>
    if (!looksLikeCaptionCue(o)) continue
    const tokens = lineTokens(String(o.text ?? ''))
    const groups = splitTokensByMaxChars(tokens, CAPTION_LINE_MAX_CHARS)
    const a0 = num(o.startMs)
    const b0 = num(o.endMs)
    if (!groups.length || a0 === null || b0 === null) {
      droppedInvalid += 1
      continue
    }
    const a = Math.max(0, pyRound(a0))
    const b = pyRound(b0)
    if (b - a < CAPTION_LINE_MIN_MS) {
      droppedInvalid += 1
      continue
    }
    const weights = groups.map((g) => Math.max(1, tokenSpanChars(g)))
    const spans = proportionalSpans(weights, a, b)
    const baseId = String(o.id ?? '')
    for (let i = 0; i < groups.length; i++) {
      const text = serializeTokens(groups[i]!)
      if (!text) continue
      const span = spans[i]!
      const id = i === 0 || !baseId ? baseId : `${baseId}~${i}`
      rows.push({ id, text, startMs: span.startMs, endMs: span.endMs })
      if (rows.length >= CAPTION_LINES_MAX) break
    }
    if (rows.length >= CAPTION_LINES_MAX) break
  }
  const orderBefore = rows.map((x) => `${x.id}:${x.startMs}:${x.endMs}`).join('|')
  rows.sort((p, q) => p.startMs - q.startMs || p.endMs - q.endMs)
  const reordered = rows.length > 1 && rows.map((x) => `${x.id}:${x.startMs}:${x.endMs}`).join('|') !== orderBefore
  const out: CaptionLine[] = []
  let prevEnd = 0
  for (const x of rows) {
    const s = Math.max(x.startMs, prevEnd)
    if (x.endMs - s < CAPTION_LINE_MIN_MS) {
      droppedInvalid += 1
      continue
    }
    out.push({ ...x, startMs: s })
    prevEnd = x.endMs
  }
  const report = { droppedInvalid, reordered }
  return { lines: attachCaptionLineNormalizeReport(out, report), report }
}

/** Valid lines sorted by start, overlaps trimmed (py normalize_caption_lines). */
export function normalizeCaptionLines(raw: unknown): CaptionLine[] {
  const { lines, report } = normalizeCaptionLinesDetailed(raw)
  return attachCaptionLineNormalizeReport(lines, report)
}

const ID_RE = /^[A-Za-z0-9_~-]{1,64}$/

/** Edits normalizer: same lines + stable unique ids; undefined when empty (key dropped). */
export function mergeCaptionLineNormalizeReports(
  previous: CaptionLineNormalizeReport | undefined,
  next: CaptionLineNormalizeReport,
): CaptionLineNormalizeReport {
  return {
    droppedInvalid: (previous?.droppedInvalid ?? 0) + next.droppedInvalid,
    reordered: Boolean(previous?.reordered || next.reordered),
  }
}

export function parseCaptionLineNormalizeReport(raw: unknown): CaptionLineNormalizeReport | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as { droppedInvalid?: unknown; reordered?: unknown }
  const dropped = Number(o.droppedInvalid)
  const droppedInvalid = Number.isFinite(dropped) && dropped > 0 ? Math.round(dropped) : 0
  const reordered = o.reordered === true
  if (droppedInvalid === 0 && !reordered) return undefined
  return { droppedInvalid, reordered }
}

/** Same as normalizeCaptionLinesEdits, but always returns the report (including when every cue is dropped). */
export function normalizeCaptionLinesEditsWithReport(raw: unknown): {
  lines: CaptionLine[] | undefined
  report: CaptionLineNormalizeReport
} {
  const { lines, report } = normalizeCaptionLinesDetailed(raw)
  if (!lines.length) return { lines: undefined, report }
  const seen = new Set<string>()
  const out = lines.map((l, i) => {
    let id = ID_RE.test(l.id) && !seen.has(l.id) ? l.id : `cl${i}_${l.startMs}`
    while (seen.has(id)) id = `${id}x`
    seen.add(id)
    return { ...l, id }
  })
  return { lines: attachCaptionLineNormalizeReport(out, report), report }
}

export function normalizeCaptionLinesEdits(raw: unknown): CaptionLine[] | undefined {
  return normalizeCaptionLinesEditsWithReport(raw).lines
}

export type CaptionLineWord = { i: number; text: string; s_ms: number; e_ms: number; ln: number; br?: true; it?: true; bo?: true }

/** Caption words (output ms) for the lines — py caption_line_words. */
export function captionLineWords(lines: unknown): CaptionLineWord[] {
  const out: CaptionLineWord[] = []
  normalizeCaptionLines(lines).forEach((line, li) => {
    const toks = lineTokens(line.text)
    const total = toks.reduce((n, t) => n + cpLen(t.w) + 1, 0)
    const s = line.startMs
    const dur = line.endMs - s
    let acc = 0
    toks.forEach((t, wi) => {
      const ws = s + Math.floor((dur * acc) / total)
      acc += cpLen(t.w) + 1
      let we = s + Math.floor((dur * acc) / total)
      if (we <= ws) we = ws + 1
      const row: CaptionLineWord = { i: CAPTION_LINE_ID_BASE + li * 1000 + wi, text: t.w, s_ms: ws, e_ms: we, ln: li }
      if (t.br) row.br = true
      if (t.it) row.it = true
      if (t.bo) row.bo = true
      out.push(row)
    })
  })
  return out
}

/** Render words (seconds) for the caption ASS — captionWordsToClipWords shape + `ln`. */
export type CaptionLineClipWord = { w: string; s: number; e: number; i: number; idx: number; ln: number; br?: true; it?: true; bo?: true }

export function captionLineClipWords(lines: unknown): CaptionLineClipWord[] {
  return captionLineWords(lines).map((c) => {
    const row: CaptionLineClipWord = { w: c.text, s: c.s_ms / 1000, e: c.e_ms / 1000, i: c.i, idx: c.i, ln: c.ln }
    if (c.br) row.br = true
    if (c.it) row.it = true
    if (c.bo) row.bo = true
    return row
  })
}

// ---- editing helpers (panel + Captions lane) ---------------------------------------------------

let idSeq = 0
export const newCaptionLineId = () => `cl${Date.now().toString(36)}${(idSeq++).toString(36)}`

/** Reading-speed length for a typed line: ~15 characters / s, 0.8 s – 6 s. */
export function readingMs(text: string): number {
  return Math.max(800, Math.min(6000, Math.round((cpLen(captionLinePlainText(text).trim()) * 1000) / 15)))
}

/**
 * Typed lines (one per row of `text`) placed back to back from `atMs`, each as long as it takes to
 * read, never overlapping the next existing line and never past `durationMs`.
 */
export function addTypedLines(lines: CaptionLine[], text: string, atMs: number, durationMs: number): CaptionLine[] {
  const rows = text.split('\n').map((r) => serializeTokens(lineTokens(r))).filter(Boolean)
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
  const toks = lineTokens(l.text)
  const words = toks.map((t) => t.w)
  if (words.length < 2) return lines
  const dur = l.endMs - l.startMs
  let k: number
  if (at.charIndex !== undefined) {
    // words that end at or before the caret (in the raw text, tags included) go left
    k = lineTokenEnds(l.text).filter((e) => e <= at.charIndex!).length
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
  const left = serializeTokens(toks.slice(0, k))
  const right = serializeTokens(toks.slice(k).map((t, j) => (j === 0 ? { ...t, br: false } : t)))
  let cut: number
  if (at.ms !== undefined && at.charIndex === undefined && at.ms > l.startMs && at.ms < l.endMs) cut = Math.round(at.ms)
  else cut = l.startMs + Math.round((dur * (cpLen(captionLinePlainText(left)) + 1)) / (cpLen(captionLinePlainText(l.text)) + 1))
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
  const tb = lineTokens(b.text)
  const text = serializeTokens([...lineTokens(a.text), ...tb.map((t, j) => (j === 0 ? { ...t, br: false } : t))])
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

/**
 * Keep a cue's <i>/<b> (any case, attributes dropped) and its line breaks; strip every other tag
 * (<font>, <u>, VTT <c.x>/<v Name>/timestamps) and ASS {\\...} overrides.
 */
export function cleanCueText(rows: string[]): string {
  return rows
    .map((r) =>
      r
        .replace(/<\s*(\/?)\s*([ib])(?:\s[^>]*)?>/gi, (_m, sl: string, t: string) => `\u0001${sl}${t.toLowerCase()}\u0002`)
        .replace(/<[^>]*>/g, '')
        .replace(/\{\\[^}]*\}/g, '')
        .replace(/\u0001/g, '<')
        .replace(/\u0002/g, '>'),
    )
    .join('\n')
}

/** Parse SRT or WebVTT text into caption lines; cues keep their lines and <i>/<b> (G3afix). */
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
    const t = serializeTokens(lineTokens(cleanCueText(text)))
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
  return normalizeCaptionLines(lines).map((l) => captionLinePlainText(l.text).replace(/\n/g, ' ')).join('\n') + '\n'
}

/**
 * G3afix: optional import re-chunk — every cue split into captions of `wordsPerLine` words, timed
 * by length like the burned captions (cue line breaks dropped, <i>/<b> kept per word).
 */
export function rechunkCaptionLines(lines: CaptionLine[], wordsPerLine: number): CaptionLine[] {
  const wpl = Math.max(1, Math.round(wordsPerLine) || 1)
  const out: CaptionLine[] = []
  for (const l of normalizeCaptionLines(lines)) {
    const toks = lineTokens(l.text).map((t) => ({ ...t, br: false }))
    const total = toks.reduce((n, t) => n + cpLen(t.w) + 1, 0)
    const dur = l.endMs - l.startMs
    let acc = 0
    for (let k = 0; k < toks.length; k += wpl) {
      const part = toks.slice(k, k + wpl)
      const a = l.startMs + Math.floor((dur * acc) / total)
      acc += part.reduce((n, t) => n + cpLen(t.w) + 1, 0)
      const b = k + wpl >= toks.length ? l.endMs : l.startMs + Math.floor((dur * acc) / total)
      out.push({ id: `cl${out.length}_${a}`, text: serializeTokens(part), startMs: a, endMs: b })
    }
  }
  // pieces shorter than the minimum are merged into the previous caption by the normalizer's trim
  const merged: CaptionLine[] = []
  for (const x of out) {
    const prev = merged[merged.length - 1]
    if (x.endMs - x.startMs < CAPTION_LINE_MIN_MS && prev && prev.endMs === x.startMs) {
      merged[merged.length - 1] = { ...prev, text: serializeTokens([...lineTokens(prev.text), ...lineTokens(x.text)]), endMs: x.endMs }
    } else merged.push(x)
  }
  return normalizeCaptionLinesEdits(merged) ?? []
}

/**
 * G3afix: import "Append" — imported lines go into the gaps of the existing ones (an imported line
 * overlapping an existing one is trimmed to start after it, or dropped when nothing is left).
 */
export function appendCaptionLines(existing: CaptionLine[], imported: CaptionLine[]): CaptionLine[] {
  const keep = normalizeCaptionLines(existing)
  const add: CaptionLine[] = []
  for (const l of normalizeCaptionLines(imported)) {
    let s = l.startMs
    let e = l.endMs
    for (const x of keep) {
      if (x.startMs <= s && s < x.endMs) s = x.endMs
    }
    const next = keep.filter((x) => x.startMs >= s).sort((p, q) => p.startMs - q.startMs)[0]
    if (next) e = Math.min(e, next.startMs)
    if (e - s >= CAPTION_LINE_MIN_MS) add.push({ ...l, id: newCaptionLineId(), startMs: s, endMs: e })
  }
  return normalizeCaptionLinesEdits([...existing, ...add]) ?? []
}
