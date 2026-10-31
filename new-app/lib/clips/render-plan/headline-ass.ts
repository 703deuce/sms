/**
 * EP2: TS port of worker/clips_worker/stream_headline_ass.headline_ass_content (+ headline_fit.
 * fit_headline_display_for_box with Python's int() steps) — byte-identical .ass for the stream
 * headline bar. lib/clips/headline-fit.ts (float steps) stays for the DOM fallback.
 */
import { headlineStyleForPreset } from '@/lib/clips/overlay-geometry'

type Dict = Record<string, unknown>

const EMOJI_TAIL = /([\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]+)\s*$/u
const HEADLINE_CHAR_LIMIT = 72
const MAX_LINES = 4
const MIN_CHARS_PER_LINE = 14
const EMOJI_FONT = 'Noto Color Emoji'

const cps = (s: string) => [...s]
const plen = (s: string) => cps(s).length
const pySplit = (s: string) => s.split(/\s+/).filter(Boolean)

/** stream_headline_ass.format_headline_for_export (Python slicing = code points). */
export function formatHeadlineForExportPy(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const m = EMOJI_TAIL.exec(trimmed)
  const emojis = m ? cps(m[1]!).slice(0, 2).join('') : ''
  const body = m ? trimmed.slice(0, m.index).trim() : trimmed
  const upper = cps(body).slice(0, HEADLINE_CHAR_LIMIT).join('').toUpperCase()
  return emojis ? `${upper} ${emojis}`.trim() : upper
}

function wrapFull(body: string, maxChars: number, maxLines = MAX_LINES): string[] {
  const words = pySplit(body)
  const lines: string[] = []
  let cur: string[] = []
  for (const w of words) {
    const trial = [...cur, w].join(' ').trim()
    if (plen(trial) > maxChars && cur.length) {
      lines.push(cur.join(' '))
      cur = [w]
      if (lines.length >= maxLines) break
    } else cur.push(w)
  }
  if (lines.length >= maxLines && cur.length) lines[lines.length - 1] = `${lines[lines.length - 1]} ${cur.join(' ')}`.trim()
  else if (cur.length && lines.length < maxLines) lines.push(cur.join(' '))
  return lines.slice(0, maxLines)
}

function charsPerLine(boxW: number, fontPx: number): number {
  const charW = Math.max(8.0, fontPx * 0.52)
  return Math.max(MIN_CHARS_PER_LINE, Math.trunc((boxW * 0.94) / charW))
}

/** headline_fit.fit_headline_display_for_box — same int() truncation at every step. */
export function fitHeadlineDisplayForBoxPy(
  formatted: string,
  boxW: number,
  boxH: number,
  boldNews = false,
): { lines: string[]; fontPx: number } {
  const trimmed = (formatted || '').trim()
  if (!trimmed || boxW <= 0 || boxH <= 0) return { lines: [], fontPx: 12 }
  const maxBarFrac = boldNews ? 0.88 : 0.24
  const widthFrac = boldNews ? 0.96 : 0.94
  const cwf = boldNews ? 0.48 : 0.52
  const targetW = boxW * widthFrac
  const m = EMOJI_TAIL.exec(trimmed)
  const emojis = m ? cps(m[1]!).slice(0, 2).join('') : ''
  const body = m ? trimmed.slice(0, m.index).trim() : trimmed
  const maxBarH = Math.max(1, Math.trunc(boxH * maxBarFrac))
  let fontPx = Math.max(
    12,
    Math.trunc(boldNews ? Math.min(boxH * 0.46, targetW / Math.max(MIN_CHARS_PER_LINE, 8)) : Math.min(boxH * 0.45, (boxH * 0.52) / 3)),
  )
  let lines: string[] = []
  for (let i = 0; i < 16; i++) {
    const cpl = charsPerLine(boxW, fontPx)
    lines = wrapFull(body, cpl, MAX_LINES)
    const lineH = Math.max(1, Math.trunc(fontPx * 1.05))
    const totalH = lineH * Math.max(1, lines.length)
    const widest = lines.length ? Math.max(...lines.map((l) => plen(l) * fontPx * cwf)) : 0
    const longest = lines.length ? Math.max(...lines.map(plen)) : 0
    if (totalH <= maxBarH && widest <= targetW && longest <= cpl + 1) break
    fontPx = Math.max(12, Math.trunc(fontPx * 0.9))
  }
  if (emojis && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]} ${emojis}`.trim()
  return { lines, fontPx }
}

const escAss = (t: string) => t.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, '\\N')

function assColor(hex: string | null | undefined): string {
  const c = (hex || '').trim().replace(/^#+/, '')
  if (c.length >= 6) return `&H00${c.slice(4, 6)}${c.slice(2, 4)}${c.slice(0, 2)}`.toUpperCase()
  return '&H00000000'
}

function splitEmojiRuns(text: string): string {
  return cps(text)
    .map((ch) => {
      const o = ch.codePointAt(0)!
      return o > 0xffff || (o >= 0x1f300 && o <= 0x1faff) ? `{\\fn${EMOJI_FONT}}${ch}` : ch
    })
    .join('')
}

function wrap22(body: string): string[] {
  // stream_headline_ass._wrap_headline_lines (legacy fallback when the fit returns no lines)
  const words = pySplit(body)
  const lines: string[] = []
  let cur: string[] = []
  for (const w of words) {
    const trial = [...cur, w].join(' ').trim()
    if (plen(trial) > 22 && cur.length) {
      lines.push(cur.join(' '))
      cur = [w]
    } else cur.push(w)
    if (lines.length >= MAX_LINES) break
  }
  if (lines.length >= MAX_LINES && cur.length) lines[MAX_LINES - 1] = `${lines[MAX_LINES - 1]} ${cur.join(' ')}`.trim()
  else if (lines.length < MAX_LINES && cur.length) lines.push(cur.join(' '))
  return lines.slice(0, MAX_LINES)
}

function prepareHeadlineDisplay(raw: string): string {
  const trimmed = formatHeadlineForExportPy(raw)
  const m = EMOJI_TAIL.exec(trimmed)
  const emojis = m ? cps(m[1]!).slice(0, 2).join('') : ''
  const core = m ? trimmed.slice(0, m.index).trim() : trimmed
  const lines = wrap22(core)
  if (emojis && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]} ${emojis}`.trim()
  return lines.filter((l) => l.trim()).map((l) => splitEmojiRuns(escAss(l.toUpperCase()))).join('\\N')
}

/** stream_headline_ass._headline_font_from_style (the image always has Anton). */
export function headlineFontFromStyle(style: Dict | null | undefined, fitTop: boolean): string {
  const raw = String(style?.font ?? '').trim()
  if (raw) {
    const low = raw.toLowerCase()
    if (low.includes('anton')) return 'Anton'
    if (low.includes('montserrat')) return 'Montserrat Black'
    if (low.includes('poppins')) return 'Poppins ExtraBold'
  }
  return fitTop ? 'Anton' : 'Montserrat Black'
}

function ts(durationMs: number): string {
  const cs = Math.floor(Math.max(1, durationMs) / 10)
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`
}

export type HeadlineAssInput = {
  headline: string
  playW: number
  playH: number
  barH: number
  durationMs: number
  barY?: number
  fitTop?: boolean
  textColor?: string | null
  headlineStyle?: Dict | null
  textBoxX?: number | null
  textBoxW?: number | null
}

/** stream_headline_ass.headline_ass_content — byte-identical. */
export function headlineAssContent(o: HeadlineAssInput): string {
  const fitTop = Boolean(o.fitTop)
  let preset: Dict = { ...headlineStyleForPreset(fitTop ? 'stream_white_box' : 'export_bar') }
  if (o.headlineStyle && typeof o.headlineStyle === 'object') preset = { ...preset, ...o.headlineStyle }
  const primary = assColor((o.textColor || (preset.textColor as string) || '#000000') as string)
  const rawHeadline = formatHeadlineForExportPy(o.headline)
  const widthPct = Math.trunc(Number(preset.widthPct || 100))
  const boxW =
    o.textBoxW != null && o.textBoxW > 0 ? Math.max(1, Math.trunc(o.textBoxW)) : Math.max(1, Math.trunc(o.playW * (widthPct / 100.0) * 0.96))
  const bold = fitTop || String(preset.preset || '') === 'bold_news'
  const fit = fitHeadlineDisplayForBoxPy(rawHeadline, boxW, o.barH, bold)
  const display = fit.lines.length
    ? fit.lines.filter((l) => l.trim()).map((l) => splitEmojiRuns(escAss(l.toUpperCase()))).join('\\N')
    : prepareHeadlineDisplay(o.headline)
  const font = headlineFontFromStyle(o.headlineStyle, fitTop)
  const fontsize = Math.max(fit.fontPx, fitTop ? 36 : 28)
  const barY = o.barY ?? 0
  const yCenter = barY + Math.floor(o.barH / 2)
  const cx = o.textBoxX != null && o.textBoxW != null && o.textBoxW > 0 ? o.textBoxX + Math.floor(o.textBoxW / 2) : Math.floor(o.playW / 2)
  return (
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${o.playW}\nPlayResY: ${o.playH}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n` +
    '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
    `Style: Headline,${font},${fontsize},${primary},${primary},&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,20,20,${Math.max(8, Math.floor(o.barH / 12))},1\n\n` +
    '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' +
    `Dialogue: 0,0:00:00.00,${ts(o.durationMs)},Headline,,0,0,0,,{\\an5\\pos(${cx},${yCenter})}${display}\n`
  )
}
