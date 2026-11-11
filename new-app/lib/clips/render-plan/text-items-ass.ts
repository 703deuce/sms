/**
 * G3b: + bold / italic marks, letter spacing, line height, gradient text, workspace fonts, the box
 * fading per unit, and shapes / stickers / progress bars (text-shapes.ts).
 *
 * EP1: TS port of worker/clips_worker/text_items.text_items_ass — byte-identical (goldens in
 * worker/tests/fixtures/render_plan). Font names are the canonical libass family names
 * (EP1: "Montserrat Black" / "Poppins ExtraBold"; fontconfig resolves either, libass-wasm only these).
 */
import { B2B_CLIP_FONT_MANIFEST } from '@/lib/clips/font-manifest-b2b.generated'
import { textWidthPx } from '@/lib/clips/caption-fit'
import { hasMotionPy, layerTransformAtPy, MOTION_FPS, normalizeKeyframes } from '@/lib/clips/render-plan/motion'
import { fitDurations, frameAnim, normAnim, splitUnits, unitState, type UnitAnim } from '@/lib/clips/render-plan/text-anim'
import { isHex, itemKind, shapeItemEvents, shapeSpec, type ShapeCtx } from '@/lib/clips/render-plan/text-shapes'
import { normMarks, safeFamily, userFontId } from '@/lib/clips/render-plan/text-rich'

export { MAX_MARKS, normMarks, safeFamily, userFontId, type TextMark } from '@/lib/clips/render-plan/text-rich'
import { hex2, pyFloatStr, pyRound, pyRoundN } from '@/lib/clips/render-plan/py'
import { normalizeLayerProps } from '@/lib/clips/editor/motion-schema'
import { layerOrder, spansTracks } from '@/lib/clips/editor/tracks'
import type { ClipEditsV2 } from '@/lib/clips/edits'

type Dict = Record<string, unknown>
export const TEXT_FONTS: Record<string, string> = {
  Montserrat: 'Montserrat Black',
  Anton: 'Anton',
  Poppins: 'Poppins ExtraBold',
  Bangers: 'Bangers',
  'Bebas Neue': 'Bebas Neue',
  'Archivo Black': 'Archivo Black',
  'Luckiest Guy': 'Luckiest Guy',
  'Rubik': 'Rubik',
  'Gabarito': 'Gabarito',
  'Fira Sans Condensed': 'Fira Sans Condensed',
  'DM Serif Display': 'DM Serif Display',
  'Playfair Display': 'Playfair Display',
  'Caveat': 'Caveat',
  'Space Grotesk': 'Space Grotesk',
  Inter: 'Inter',
  Lato: 'Lato Black',
  Oswald: 'Oswald',
  'Space Mono': 'Space Mono',
  ...Object.fromEntries(B2B_CLIP_FONT_MANIFEST.map((f) => [f.id, f.assFamily])),
}
const REF_H = 1920
const AN: Record<string, number> = { left: 4, center: 5, right: 6 }
const METRIC_FONT: Record<string, string> = { Montserrat: 'Montserrat Black', Poppins: 'Poppins ExtraBold' }
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)
const truthy = (v: unknown) => !(v === undefined || v === null || v === false || v === 0 || v === '')
const or = (a: unknown, b: unknown) => (truthy(a) ? a : b)

export const GRADIENT_BANDS = 24
export const LINE_HEIGHT_MIN = 0.7
export const LINE_HEIGHT_MAX = 2.5
export const LETTER_SPACING_MIN = -20
export const LETTER_SPACING_MAX = 100
/** (Style Fontname, caption-fit metrics name) of a text style (py font_names). */
export function fontNames(st: Dict): [string, string] {
  let font = String(or(st.font, ''))
  if (userFontId(font)) {
    const fam = safeFamily(st.fontFamily)
    if (fam) return [fam, fam]
  }
  if (!(font in TEXT_FONTS)) font = 'Montserrat'
  return [TEXT_FONTS[font]!, METRIC_FONT[font] ?? font]
}

const pyNum = (v: unknown, dflt: number): number => {
  if (!truthy(v)) return dflt
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string' && v.trim() !== '') return Number(v.trim())
  return NaN
}

export function letterSpacingPx(st: Dict, h: number): number {
  const v = pyNum(st.letterSpacing, 0)
  if (Number.isNaN(v) || !v) return 0.0
  const c = Math.min(LETTER_SPACING_MAX, Math.max(LETTER_SPACING_MIN, v))
  return pyRoundN((c * h) / REF_H, 2)
}

export function lineHeightMult(st: Dict): number {
  const v = pyNum(st.lineHeight, 1)
  if (Number.isNaN(v)) return 1.0
  return pyRoundN(Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, v)), 2)
}

export type Gradient = { from: string; to: string; dir: 'v' | 'h' }
export function gradientOf(st: Dict): Gradient | null {
  const g = st.gradient
  if (!isDict(g) || !isHex(g.from) || !isHex(g.to)) return null
  return { from: g.from, to: g.to, dir: g.dir === 'h' ? 'h' : 'v' }
}

/** Widest line at ASS fontsize; fontId = a TEXT_FONTS id or a metrics name; spacing px per char. */
export function textBlockWidthPx(text: string, fontId: string, fontsize: number, spacing = 0.0): number {
  const name = METRIC_FONT[fontId] ?? fontId
  let m = 0
  for (const line of String(text).split('\n')) m = Math.max(m, textWidthPx(line, name, fontsize) + spacing * Array.from(line).length)
  return m
}

const alignDx = (align: string, w: number) => (align === 'left' ? -w / 2 : align === 'right' ? w / 2 : 0.0)

function assColor(hexRgb: unknown, alpha = 0): string {
  let h = String(hexRgb ?? '').trim().replace(/^#+/, '')
  if (h.length !== 6) h = 'FFFFFF'
  const [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((x) => parseInt(x, 16))
  return `&H${hex2(alpha)}${hex2(b!)}${hex2(g!)}${hex2(r!)}`
}

const alphaForOpacity = (op: unknown) => Math.max(0, Math.min(255, pyRound(255 * (1 - Math.max(0, Math.min(100, Number(op))) / 100))))

function ts(cs0: number): string {
  const cs = Math.max(0, Math.trunc(cs0))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\r/g, '').replace(/\n/g, '\\N')

export type TextItemRow = Dict & { id: string; text: string; startMs: number; endMs: number; style: Dict }

export function textItemsPy(edits: Dict): TextItemRow[] {
  const raw = edits.textItems
  if (!Array.isArray(raw)) return []
  const out: TextItemRow[] = []
  for (const it of raw) {
    if (!isDict(it) || !truthy(it.id)) continue
    // G3b: shapes / stickers / progress bars have no text.
    if (itemKind(it) === 'text') {
      if (!String(or(it.text, '')).trim()) continue
    } else if (shapeSpec(it) === null) continue
    const a0 = Number(it.startMs)
    const b0 = Number(it.endMs)
    if (it.startMs === null || it.endMs === null || it.startMs === undefined || it.endMs === undefined || !Number.isFinite(a0) || !Number.isFinite(b0)) continue
    const a = pyRound(a0)
    const b = pyRound(b0)
    if (b <= a) continue
    out.push({ ...it, startMs: a, endMs: b, style: isDict(it.style) ? it.style : {} } as TextItemRow)
  }
  return out
}

/** Python str(float | int) for _px results (float) and the literal int 0. */
const px = (v: unknown, h: number): string => {
  const f = Number(v)
  return pyFloatStr(Number.isFinite(f) ? pyRoundN((f * h) / REF_H, 2) : 0.0)
}

function stylesFor(i: number, it: TextItemRow, h: number): [string, string | null] {
  const st = it.style
  const font = fontNames(st)[0]
  const size = Math.max(1, pyRound((Number(or(st.size, 96)) * h) / REF_H))
  const an = AN[String(or(st.align, 'center'))] ?? 5
  const primary = assColor(or(st.color, '#FFFFFF'))
  const stroke = isDict(st.stroke) ? st.stroke : null
  const shadow = isDict(st.shadow) ? st.shadow : null
  const box = isDict(st.box) ? st.box : null
  const outlineC = assColor(or(stroke?.color, '#000000'))
  const outlineW = stroke ? px(or(stroke.width, 0), h) : '0'
  const backC = shadow ? assColor(or(shadow.color, '#000000'), alphaForOpacity(shadow.opacity ?? 100)) : '&HFF000000'
  const shadowD = shadow ? px(or(shadow.dist, 0), h) : '0'
  const spN = letterSpacingPx(st, h)
  const sp = spN ? pyFloatStr(spN) : '0'
  const textStyle = `Style: T${i},${font},${size},${primary},${primary},${outlineC},${backC},0,0,0,0,100,100,${sp},0,1,${outlineW},${shadowD},${an},0,0,0,1`
  let boxStyle: string | null = null
  if (box) {
    const boxC = assColor(or(box.color, '#000000'), alphaForOpacity(box.opacity ?? 100))
    boxStyle = `Style: B${i},${font},${size},&HFF000000,&HFF000000,${boxC},&HFF000000,0,0,0,0,100,100,${sp},0,3,${px(or(box.pad, 0), h)},0,${an},0,0,0,1`
  }
  return [textStyle, boxStyle]
}

const anchor = (it: Dict, w: number, h: number): [number, number] => [(Number(it.x ?? 50) * w) / 100, (Number(it.y ?? 50) * h) / 100]

const IDENT = { x: 0.0, y: 0.0, scale: 100.0, rotation: 0.0, opacity: 100.0 }

/** Display chars with mark bits (1 bold, 2 italic) — py rich_chars. */
export function richChars(it: Dict, upper: boolean): [string, number][] {
  const text = Array.from(String(it.text ?? ''))
  const flags = new Array<number>(text.length).fill(0)
  for (const m of normMarks(it.marks, text.length)) {
    const bit = (m.b ? 1 : 0) | (m.i ? 2 : 0)
    for (let k = m.s; k < m.e; k++) flags[k]! |= bit
  }
  const out: [string, number][] = []
  text.forEach((ch, k) => {
    for (const c of Array.from(upper ? ch.toUpperCase() : ch)) out.push([c, flags[k]!])
  })
  return out
}

function markTag(old: number, nw: number): string {
  let t = ''
  if ((old ^ nw) & 1) t += nw & 1 ? '\\b1' : '\\b0'
  if ((old ^ nw) & 2) t += nw & 2 ? '\\i1' : '\\i0'
  return `{${t}}`
}

function richLines(chars: [string, number][], pieces: [string, boolean][], tags: (string | null)[], perLine: boolean): string[] {
  const lines = ['']
  let state = 0
  let pos = 0
  pieces.forEach(([piece], k) => {
    const tag = tags[k]
    if (tag) lines[lines.length - 1] += tag
    for (const ch of Array.from(piece)) {
      const f = pos < chars.length ? chars[pos]![1] : 0
      pos += 1
      if (ch === '\n') {
        if (perLine) {
          lines.push('')
          state = 0
        } else lines[lines.length - 1] += '\\N'
        continue
      }
      if (f !== state) {
        lines[lines.length - 1] += markTag(state, f)
        state = f
      }
      lines[lines.length - 1] += esc(ch)
    }
  })
  return lines
}

/** G3a unit alpha (+ pop height) tags; boxA set → the BOX layer (\3a per unit, G3b) — py _unit_tags. */
function unitTags(txt: string, unit: UnitAnim, op: number, shadowA: number, scale: number, boxA: number | null): [[string, boolean][], (string | null)[]] {
  const pieces = splitUnits(txt, unit.unit)
  const n = pieces.filter(([, u]) => u).length
  const tags: (string | null)[] = []
  let k = 0
  for (const [, isUnit] of pieces) {
    if (!isUnit) {
      tags.push(null)
      continue
    }
    const kk = unit.rev ? n - 1 - k : k
    const [uo, us] = unitState(unit.type, kk, n, unit.t, unit.d)
    const o = op * uo
    let tag: string
    if (boxA === null) {
      const a = pyRound(255 * (1 - o))
      const aSh = pyRound(255 - (255 - shadowA) * o)
      tag = `\\1a&H${hex2(a)}&\\3a&H${hex2(a)}&\\4a&H${hex2(aSh)}&`
    } else {
      tag = `\\3a&H${hex2(pyRound(255 - (255 - boxA) * o))}&`
    }
    if (us !== 1.0) tag += `\\fscy${pyFloatStr(pyRoundN(scale * us, 2))}`
    tags.push(`{${tag}}`)
    k += 1
  }
  if (boxA !== null) {
    let nxt: string | null = null
    for (let j = tags.length - 1; j >= 0; j--) {
      if (pieces[j]![1]) nxt = tags[j]!
      else if (nxt) tags[j] = nxt
    }
  }
  return [pieces, tags]
}

/** G3b gradient: GRADIENT_BANDS screen-space \clip stripes, each with its \1c (py _gradient_bands). */
function gradientBands(g: Gradient, cx: number, cy: number, bw: number, bh: number, w: number, h: number): string[] {
  const n = GRADIENT_BANDS
  const a = g.from.slice(1)
  const b = g.to.slice(1)
  const ca = [0, 2, 4].map((o) => parseInt(a.slice(o, o + 2), 16))
  const cb = [0, 2, 4].map((o) => parseInt(b.slice(o, o + 2), 16))
  const vert = g.dir === 'v'
  const lim = vert ? h : w
  const lo = vert ? cy - bh / 2 : cx - bw / 2
  const span = vert ? bh : bw
  const edges = [0]
  for (let k = 1; k < n; k++) edges.push(Math.min(lim, Math.max(0, pyRound(lo + (span * k) / n))))
  edges.push(lim)
  const out: string[] = []
  for (let k = 0; k < n; k++) {
    const e0 = edges[k]!
    const e1 = edges[k + 1]!
    if (e1 <= e0) continue
    const t = k / (n - 1)
    const [r, gg, bb] = [0, 1, 2].map((j) => pyRound(ca[j]! + (cb[j]! - ca[j]!) * t))
    const clip = vert ? `\\clip(0,${e0},${w},${e1})` : `\\clip(${e0},0,${e1},${h})`
    out.push(`${clip}\\1c&H${hex2(bb!)}${hex2(gg!)}${hex2(r!)}&`)
  }
  return out
}

const SHAPE_CTX: ShapeCtx = { alphaForOpacity, anchor, gradientBands, ts, gradientOf }

export function buildTextItemsAss(edits: Dict, w: number, h: number, fps = MOTION_FPS): string | null {
  let items = textItemsPy(edits)
  if (!items.length) return null
  // G1a: mirror of text_items.py — stacking order (bottom → top) + one layer pair per item when set.
  const zRows = normalizeLayerProps(edits.layerProps) ?? []
  const zOf = (id: string) => zRows.find((r) => r.target === `text:${id}`)?.z ?? 0
  // G1b: items on several text tracks stack by track (tracks.layerOrder) — same layer pairs.
  const zOn = items.some((it) => zOf(String(it.id)) !== 0) || spansTracks(edits as Pick<ClipEditsV2, 'tracks'>, 'text', items.map((it) => String(it.id)))
  if (zOn) items = layerOrder(edits as Pick<ClipEditsV2, 'tracks'>, 'text', items.map((it) => ({ ...it, id: String(it.id) }) as TextItemRow), zOf)
  const tracks = normalizeKeyframes(edits.keyframes)
  const styles: string[] = []
  const events: string[] = []
  items.forEach((it, i) => {
    const [tsStyle, bs] = stylesFor(i, it, h)
    const [lt, lb] = zOn ? [2 * i + 1, 2 * i] : [1, 0]
    if (itemKind(it) !== 'text') {
      styles.push(tsStyle)
      events.push(...shapeItemEvents(i, it, tracks, SHAPE_CTX, w, h, fps, lt))
      return
    }
    styles.push(tsStyle)
    if (bs) styles.push(bs)
    const st = it.style
    const chars = richChars(it, st.case === 'upper')
    const txt = chars.map(([c]) => c).join('')
    const [ax, ay] = anchor(it, w, h)
    const align = String(or(st.align, 'center'))
    const an = AN[align] ?? 5
    const metric = fontNames(st)[1]
    const fsize = Math.max(1, pyRound((Number(or(st.size, 96)) * h) / REF_H))
    const sp = letterSpacingPx(st, h)
    const grad = gradientOf(st)
    const lhm = lineHeightMult(st)
    const perLine = lhm !== 1.0
    const nLines = txt.split('\n').length
    const lh = fsize * lhm
    const blockW = an !== 5 || (grad && grad.dir === 'h') ? textBlockWidthPx(txt, metric, fsize, sp) : 0.0
    const blockH = nLines * lh
    const layers: [number, string][] = [[lt, `T${i}`], ...(bs ? ([[lb, `B${i}`]] as [number, string][]) : [])]
    const target = `text:${it.id}`
    const start = it.startMs
    const end = it.endMs
    const motion = hasMotionPy(tracks, target)
    const anim = normAnim(it.anim)
    const plainLines = richLines(chars, [[txt, false]], [null], perLine)
    const lineY = (j: number, cy: number, scale: number) => pyRound(cy + ((((j - (nLines - 1) / 2) * lh) * scale) / 100))
    const emit = (layer: number, style: string, sCs: number, eCs: number, tagOf: (yy: number | null, band: string) => string, bodies: string[], cy: number, scale: number, bands: string[] | null) => {
      const bl = style.startsWith('T') ? (bands && bands.length ? bands : ['']) : ['']
      for (const band of bl) {
        if (perLine) bodies.forEach((body, j) => events.push(`Dialogue: ${layer},${ts(sCs)},${ts(eCs)},${style},,0,0,0,,${tagOf(lineY(j, cy, scale), band)}${body}`))
        else events.push(`Dialogue: ${layer},${ts(sCs)},${ts(eCs)},${style},,0,0,0,,${tagOf(null, band)}${bodies[0]}`)
      }
    }
    const sx = pyRound(ax + alignDx(align, blockW))
    const staticTag = (yy: number | null, band: string) => `{\\an${an}\\pos(${sx},${yy === null ? pyRound(ay) : yy})${band}}`
    const staticBands = grad ? gradientBands(grad, ax, ay, blockW, blockH, w, h) : null
    if (!motion && !anim) {
      for (const [layer, style] of layers) emit(layer, style, Math.floor(start / 10), Math.floor(end / 10), staticTag, plainLines, ay, 100.0, staticBands)
      return
    }
    const shadow = isDict(st.shadow) ? st.shadow : null
    const shadowA = shadow ? alphaForOpacity(shadow.opacity ?? 100) : 255
    const box = isDict(st.box) ? st.box : null
    const boxA = box ? alphaForOpacity(box.opacity ?? 100) : 255
    const f0 = Math.trunc(Math.ceil((start * fps) / 1000 - 1e-9))
    const f1 = Math.trunc(Math.ceil((end * fps) / 1000 - 1e-9))
    const [dIn, dOut] = anim ? fitDurations(anim, end - start) : [0, 0]
    // G3a: without keyframes / loop only the in + out windows go per frame (py text_items_ass).
    let spans: [number, number][]
    let mid: [number, number] | null = null
    if (motion || (anim && anim.loop)) spans = [[f0, f1]]
    else {
      const fi = dIn ? Math.trunc(Math.ceil(((start + dIn) * fps) / 1000 - 1e-9)) : f0
      let fo = dOut ? Math.trunc(Math.ceil(((end - dOut) * fps) / 1000 - 1e-9)) : f1
      fo = Math.max(fo, fi)
      spans = [[f0, fi], [fo, f1]]
      const csA = dIn ? Math.trunc(Math.floor((fi * 100) / fps + 1e-9)) : Math.floor(start / 10)
      const csB = dOut ? Math.trunc(Math.floor((fo * 100) / fps + 1e-9)) : Math.floor(end / 10)
      mid = csB > csA ? [csA, csB] : null
    }
    spans.forEach(([fa, fb], si) => {
      if (si === 1 && mid) {
        for (const [layer, style] of layers) emit(layer, style, mid[0], mid[1], staticTag, plainLines, ay, 100.0, staticBands)
      }
      for (let f = fa; f < fb; f++) {
        const tMs = (f * 1000) / fps
        const sCs = Math.trunc(Math.floor((f * 100) / fps + 1e-9))
        const eCs = Math.trunc(Math.floor(((f + 1) * 100) / fps + 1e-9))
        if (eCs <= sCs) continue
        let tf = motion ? layerTransformAtPy(tracks, target, tMs - start) : { ...IDENT }
        let unit: UnitAnim | null = null
        if (anim) {
          const fan = frameAnim(anim, tMs, start, end, dIn, dOut)
          tf = { ...tf, x: tf.x + fan.dx, y: tf.y + fan.dy, scale: tf.scale * fan.sc, rotation: tf.rotation + fan.rot, opacity: tf.opacity * fan.op }
          unit = fan.unit
        }
        const op = Math.max(0, Math.min(1, tf.opacity / 100))
        const aTxt = pyRound(255 * (1 - op))
        const aSh = pyRound(255 - (255 - shadowA) * op)
        const aBox = pyRound(255 - (255 - boxA) * op)
        const cxf = ax + (tf.x * w) / 100
        const cyf = ay + (tf.y * h) / 100
        const pxo = pyRound(cxf)
        const pyo = pyRound(cyf)
        const sc = pyFloatStr(pyRoundN(tf.scale, 2))
        const rot = pyFloatStr(pyRoundN(-tf.rotation, 2))
        // Scale about the block centre (the anchor): the \an4/6 point moves with the scaled width.
        const pxa = pyRound(cxf + alignDx(align, (blockW * tf.scale) / 100))
        let tLines = plainLines
        let bLines = plainLines
        if (unit) {
          const [pieces, ttags] = unitTags(txt, unit, op, shadowA, tf.scale, null)
          tLines = richLines(chars, pieces, ttags, perLine)
          if (bs) {
            const [bp, btags] = unitTags(txt, unit, op, shadowA, tf.scale, boxA)
            bLines = richLines(chars, bp, btags, perLine)
          }
        }
        const bands = grad ? gradientBands(grad, cxf, cyf, (blockW * tf.scale) / 100, (blockH * tf.scale) / 100, w, h) : null
        for (const [layer, style] of layers) {
          const alpha = style.startsWith('T') ? `\\1a&H${hex2(aTxt)}&\\3a&H${hex2(aTxt)}&\\4a&H${hex2(aSh)}&` : `\\1a&HFF&\\3a&H${hex2(aBox)}&\\4a&HFF&`
          const bodies = style.startsWith('T') ? tLines : bLines
          const tagOf = (yy: number | null, band: string) => `{\\an${an}\\pos(${pxa},${yy === null ? pyo : yy})\\org(${pxo},${pyo})\\fscx${sc}\\fscy${sc}\\frz${rot}${alpha}${band}}`
          emit(layer, style, sCs, eCs, tagOf, bodies, cyf, tf.scale, bands)
        }
      }
    })
  })
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`
  return header + styles.join('\n') + '\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' + events.join('\n') + '\n'
}
