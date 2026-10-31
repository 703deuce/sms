/**
 * EP1: template title — mirror of worker/clips_worker/title_fit.py (one measured line-breaking
 * method on both sides; byte-identical .ass, goldens in worker/tests/fixtures/render_plan).
 */
import { assEmPerFontsize, textWidthPx } from '@/lib/clips/caption-fit'

export const TITLE_MAX_LINES = 3
const TITLE_WIDTH_SLACK = 0.96
const TITLE_HEIGHT_FRAC = 0.72
const TITLE_ONE_LINE_EM_FRAC = 0.34
const TITLE_MIN_FONTSIZE = 10
const REF_FS = 100.0
const TITLE_FONTS: [string, string][] = [
  ['anton', 'Anton'],
  ['montserrat', 'Montserrat Black'],
  ['poppins', 'Poppins ExtraBold'],
]

export type Rect = { x: number; y: number; w: number; h: number }

export function titleFontName(style: { font?: unknown } | null | undefined): string {
  const raw = String(style?.font ?? '').trim().toLowerCase()
  for (const [k, v] of TITLE_FONTS) if (raw.includes(k)) return v
  return 'Anton'
}

function* combinations(n: number, k: number, start = 1): Generator<number[]> {
  if (k === 0) {
    yield []
    return
  }
  for (let i = start; i < n; i++) for (const rest of combinations(n, k - 1, i + 1)) yield [i, ...rest]
}

function bestSplit(words: string[], n: number, font: string): [string[], number] {
  let best: [string[], number] | null = null
  for (const cuts of combinations(words.length, n - 1)) {
    const b = [0, ...cuts, words.length]
    const lines = Array.from({ length: n }, (_, i) => words.slice(b[i], b[i + 1]).join(' '))
    let widest = -Infinity
    for (const ln of lines) widest = Math.max(widest, textWidthPx(ln, font, REF_FS))
    if (best === null || widest < best[1]) best = [lines, widest]
  }
  return best!
}

/** Python str.split() (any whitespace run, no empties). */
const pySplit = (s: string) => s.split(/\s+/).filter(Boolean)

export function fitTitle(text: string, font: string, boxW: number, boxH: number): { lines: string[]; fontsize: number } {
  const words = pySplit(String(text ?? ''))
  if (!words.length || boxW <= 0 || boxH <= 0) return { lines: [], fontsize: TITLE_MIN_FONTSIZE }
  const cap = (boxH * TITLE_ONE_LINE_EM_FRAC) / assEmPerFontsize(font)
  let bestLines: string[] = []
  let bestFs = -1
  for (let n = 1; n <= Math.min(TITLE_MAX_LINES, words.length); n++) {
    const [lines, widest] = bestSplit(words, n, font)
    const fsW = widest > 0 ? (boxW * TITLE_WIDTH_SLACK * REF_FS) / widest : cap
    const fsV = (boxH * TITLE_HEIGHT_FRAC) / n
    const fs = Math.trunc(Math.min(fsW, fsV, cap))
    if (fs > bestFs) {
      bestLines = lines
      bestFs = fs
    }
  }
  return { lines: bestLines, fontsize: Math.max(TITLE_MIN_FONTSIZE, bestFs) }
}

const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, ' ')

function assColor(hex: string): string {
  const c = String(hex ?? '').trim().replace(/^#+/, '')
  if (c.length >= 6) return `&H00${c.slice(4, 6)}${c.slice(2, 4)}${c.slice(0, 2)}`.toUpperCase()
  return '&H00FFFFFF'
}

function ts(ms: number): string {
  const cs = Math.floor(Math.max(1, Math.trunc(ms)) / 10)
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

/** Text box inside the title rect (title_fit.title_text_box). */
export function titleTextBox(r: Rect, kind: string): Rect {
  const x = Math.trunc(r.x), y = Math.trunc(r.y), w = Math.trunc(r.w), h = Math.trunc(r.h)
  const pad = Math.trunc(w * 0.06)
  if (kind === 'box') {
    const bh = Math.trunc(h * 0.72)
    return { x: x + pad, y: y + Math.floor((h - bh) / 2), w: w - 2 * pad, h: bh }
  }
  return { x: x + pad, y, w: w - 2 * pad, h }
}

export function buildTitleAss(o: {
  text: string; playW: number; playH: number; rect: Rect; kind: string; textColor: string; font: string; durationMs: number
}): string {
  const tb = titleTextBox(o.rect, o.kind)
  const { lines, fontsize } = fitTitle(o.text, o.font, tb.w, tb.h)
  const primary = assColor(o.textColor)
  const body = lines.map(esc).join('\\N')
  const cx = tb.x + Math.floor(tb.w / 2)
  const cy = tb.y + Math.floor(tb.h / 2)
  return (
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${o.playW}\nPlayResY: ${o.playH}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n` +
    '[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, ' +
    'Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
    `Style: Title,${o.font},${fontsize},${primary},${primary},&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1\n\n` +
    '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' +
    `Dialogue: 0,0:00:00.00,${ts(o.durationMs)},Title,,0,0,0,,{\\an5\\pos(${cx},${cy})}${body}\n`
  )
}

type TitleStyleRow = { text?: string; font?: string; bg?: { kind?: string } }
export type TemplateTitleInput = {
  text: string
  rect: Rect
  kind: string
  textColor: string
  font: string
  playW: number
  playH: number
}

/**
 * Inputs of clip_export_template._t6_title_burn for the editor (rect, background kind, text colour,
 * font, formatted text) — the preview and the export fit + draw the same title.
 */
export function templateTitleInput(
  spec: { playW: number; playH: number; titleRect?: Rect | null },
  rawText: string,
  headlineStyle: { t6Id?: string | null; textColor?: string; font?: string } | null | undefined,
  titleStyles: Record<string, TitleStyleRow>,
  formatHeadline: (s: string) => string,
): TemplateTitleInput | null {
  const text = formatHeadline(rawText)
  if (!text.trim() || spec.playW <= 0) return null
  const rect =
    spec.titleRect && spec.titleRect.h >= 8
      ? spec.titleRect
      : { x: 0, y: 0, w: spec.playW, h: Math.round((384 / 1920) * spec.playH) }
  const t6 = String(headlineStyle?.t6Id ?? '').trim()
  const st = (t6 ? titleStyles[t6] : undefined) ?? (t6 ? {} : titleStyles.white_on_black ?? {})
  return {
    text,
    rect: { x: Math.trunc(rect.x), y: Math.trunc(rect.y), w: Math.max(2, Math.trunc(rect.w)), h: Math.max(2, Math.trunc(rect.h)) },
    kind: st.bg?.kind ?? 'band',
    textColor: headlineStyle?.textColor || st.text || '#FFFFFF',
    font: titleFontName({ font: headlineStyle?.font || st.font || 'Anton' }),
    playW: spec.playW,
    playH: spec.playH,
  }
}
