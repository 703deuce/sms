/**
 * EP1: TS port of worker/clips_worker/text_items.text_items_ass — byte-identical (goldens in
 * worker/tests/fixtures/render_plan). Font names are the canonical libass family names
 * (EP1: "Montserrat Black" / "Poppins ExtraBold"; fontconfig resolves either, libass-wasm only these).
 */
import { textWidthPx } from '@/lib/clips/caption-fit'
import { hasMotionPy, layerTransformAtPy, MOTION_FPS, normalizeKeyframes } from '@/lib/clips/render-plan/motion'
import { fitDurations, frameAnim, normAnim, splitUnits, unitState, type UnitAnim } from '@/lib/clips/render-plan/text-anim'
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
}
const REF_H = 1920
const AN: Record<string, number> = { left: 4, center: 5, right: 6 }
const METRIC_FONT: Record<string, string> = { Montserrat: 'Montserrat Black', Poppins: 'Poppins ExtraBold' }
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)
const truthy = (v: unknown) => !(v === undefined || v === null || v === false || v === 0 || v === '')
const or = (a: unknown, b: unknown) => (truthy(a) ? a : b)

export function textBlockWidthPx(text: string, fontId: string, fontsize: number): number {
  const name = METRIC_FONT[fontId] ?? fontId
  let m = 0
  for (const line of String(text).split('\n')) m = Math.max(m, textWidthPx(line, name, fontsize))
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
    if (!isDict(it) || !String(or(it.text, '')).trim() || !truthy(it.id)) continue
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
  const font = TEXT_FONTS[String(or(st.font, ''))] ?? 'Montserrat Black'
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
  const textStyle = `Style: T${i},${font},${size},${primary},${primary},${outlineC},${backC},0,0,0,0,100,100,0,0,1,${outlineW},${shadowD},${an},0,0,0,1`
  let boxStyle: string | null = null
  if (box) {
    const boxC = assColor(or(box.color, '#000000'), alphaForOpacity(box.opacity ?? 100))
    boxStyle = `Style: B${i},${font},${size},&HFF000000,&HFF000000,${boxC},&HFF000000,0,0,0,0,100,100,0,0,3,${px(or(box.pad, 0), h)},0,${an},0,0,0,1`
  }
  return [textStyle, boxStyle]
}

const IDENT = { x: 0.0, y: 0.0, scale: 100.0, rotation: 0.0, opacity: 100.0 }

/** G3a: per line / word / character inline alpha (+ pop height) — py _unit_body. */
function unitBody(txt: string, unit: UnitAnim, op: number, shadowA: number, scale: number): string {
  const pieces = splitUnits(txt, unit.unit)
  const n = pieces.filter(([, u]) => u).length
  const parts: string[] = []
  let k = 0
  for (const [piece, isUnit] of pieces) {
    if (!isUnit) {
      parts.push(esc(piece))
      continue
    }
    const kk = unit.rev ? n - 1 - k : k
    const [uo, us] = unitState(unit.type, kk, n, unit.t, unit.d)
    const o = op * uo
    const a = pyRound(255 * (1 - o))
    const aSh = pyRound(255 - (255 - shadowA) * o)
    let tag = `\\1a&H${hex2(a)}&\\3a&H${hex2(a)}&\\4a&H${hex2(aSh)}&`
    if (us !== 1.0) tag += `\\fscy${pyFloatStr(pyRoundN(scale * us, 2))}`
    parts.push(`{${tag}}${esc(piece)}`)
    k += 1
  }
  return parts.join('')
}

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
    styles.push(tsStyle)
    if (bs) styles.push(bs)
    const st = it.style
    let txt = String(it.text)
    if (st.case === 'upper') txt = txt.toUpperCase()
    const e = esc(txt)
    const ax = (Number(it.x ?? 50) * w) / 100
    const ay = (Number(it.y ?? 50) * h) / 100
    const align = String(or(st.align, 'center'))
    const an = AN[align] ?? 5
    let fontId = String(or(st.font, ''))
    fontId = fontId in TEXT_FONTS ? fontId : 'Montserrat'
    const fsize = Math.max(1, pyRound((Number(or(st.size, 96)) * h) / REF_H))
    const blockW = an !== 5 ? textBlockWidthPx(txt, fontId, fsize) : 0.0
    const [lt, lb] = zOn ? [2 * i + 1, 2 * i] : [1, 0]
    const layers: [number, string][] = [[lt, `T${i}`], ...(bs ? ([[lb, `B${i}`]] as [number, string][]) : [])]
    const target = `text:${it.id}`
    const start = it.startMs
    const end = it.endMs
    const motion = hasMotionPy(tracks, target)
    const anim = normAnim(it.anim)
    const staticTag = `{\\an${an}\\pos(${pyRound(ax + alignDx(align, blockW))},${pyRound(ay)})}`
    if (!motion && !anim) {
      for (const [layer, style] of layers) events.push(`Dialogue: ${layer},${ts(Math.floor(start / 10))},${ts(Math.floor(end / 10))},${style},,0,0,0,,${staticTag}${e}`)
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
        for (const [layer, style] of layers) events.push(`Dialogue: ${layer},${ts(mid[0])},${ts(mid[1])},${style},,0,0,0,,${staticTag}${e}`)
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
        const pxo = pyRound(ax + (tf.x * w) / 100)
        const pyo = pyRound(ay + (tf.y * h) / 100)
        const sc = pyFloatStr(pyRoundN(tf.scale, 2))
        const rot = pyFloatStr(pyRoundN(-tf.rotation, 2))
        const pxa = pyRound(ax + (tf.x * w) / 100 + alignDx(align, (blockW * tf.scale) / 100))
        const base = `\\an${an}\\pos(${pxa},${pyo})\\org(${pxo},${pyo})\\fscx${sc}\\fscy${sc}\\frz${rot}`
        const body = unit ? unitBody(txt, unit, op, shadowA, tf.scale) : e
        for (const [layer, style] of layers) {
          if (style.startsWith('T')) {
            events.push(`Dialogue: ${layer},${ts(sCs)},${ts(eCs)},${style},,0,0,0,,{${base}\\1a&H${hex2(aTxt)}&\\3a&H${hex2(aTxt)}&\\4a&H${hex2(aSh)}&}${body}`)
          } else {
            events.push(`Dialogue: ${layer},${ts(sCs)},${ts(eCs)},${style},,0,0,0,,{${base}\\1a&HFF&\\3a&H${hex2(aBox)}&\\4a&HFF&}${e}`)
          }
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
