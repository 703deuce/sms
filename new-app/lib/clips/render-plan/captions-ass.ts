/**
 * EP1: TS port of worker/clips_worker/captions_ass.build_ass (+ caption_safe_area.clamp_caption_export_style,
 * t6_captions.map_v2_to_legacy_ass_preset). Emits the export's caption .ass byte for byte
 * (goldens: worker/tests/fixtures/render_plan/*.ass, asserted by vitest AND pytest).
 * EP2: the editor preview feeds this script to libass-wasm, so preview captions are drawn by the same
 * rasteriser from the same bytes as the burned-in export.
 */
import { byId as LEGACY_PRESETS } from '@/lib/clips/caption-presets'
import { CAPTION_PRESETS_V2 } from '@/lib/clips/templates/registry'
import { captionSafeWidthPx, fitCaptionLine, fitReferenceFrame, roundHalfUp } from '@/lib/clips/caption-fit'
import { hex2, pyFixedPad, pyFloat, pyInt, pyRound, pyRoundN } from '@/lib/clips/render-plan/py'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { assFontForCaptionSample } from '@/lib/clips/caption-intl'
import { captionAssMotionTags, captionMotionAt } from '@/lib/clips/editor/caption-keyframes'

/** G3a: `ln` = manual caption line index (captionLines) — one caption per line. */
/** G3afix: `br` = starts a new line of a manual caption line; `it`/`bo` = <i>/<b> from SRT/VTT/typed. */
export type AssWord = { w: string; s: number; e: number; i?: number; spk?: number; ln?: number; br?: boolean; it?: boolean; bo?: boolean }
type Dict = Record<string, unknown>
type Preset = Dict & {
  slug?: string
  font?: string
  primary: string
  active: string
  activeB: string
  outline: string
  box?: Dict | null
}

export const POP_TAG = String.raw`\fscx85\fscy85\t(0,80,\fscx112\fscy112)\t(80,160,\fscx100\fscy100)`
export const BOUNCE_TAG = String.raw`\fscy70\t(0,90,\fscy118)\t(90,180,\fscy100)`
const GLOW_TAG_INNER = String.raw`\blur4\t(0,200,\blur9)\t(200,400,\blur4)`

/** Mirror of captions_ass._ASS_FONT_FILES keys (all bundled) + _ASS_FONT_ALIASES. */
const ASS_FONT_FILES = new Set([
  'Poppins ExtraBold', 'Anton', 'Montserrat Black', 'Bangers', 'Inter', 'Lato', 'Lato Black', 'Bebas Neue', 'Luckiest Guy', 'Archivo Black', 'Oswald',
  'Noto Sans', 'Noto Sans Arabic', 'Noto Sans CJK JP', 'Noto Sans Devanagari', 'Noto Sans Thai',
])
const ASS_FONT_ALIASES: Record<string, string> = {
  Poppins: 'Poppins ExtraBold', Anton: 'Anton', 'Montserrat Black': 'Montserrat Black', Montserrat: 'Montserrat Black',
  Bangers: 'Bangers', Inter: 'Inter', Lato: 'Lato Black', 'Lato Black': 'Lato Black', 'Bebas Neue': 'Bebas Neue', 'Luckiest Guy': 'Luckiest Guy',
  'Archivo Black': 'Archivo Black', Oswald: 'Oswald',
}

const truthy = (v: unknown): boolean =>
  !(v === undefined || v === null || v === false || v === 0 || v === '' || (Array.isArray(v) && v.length === 0) ||
    (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0))
const or = <T,>(...vs: unknown[]): T => {
  for (const v of vs.slice(0, -1)) if (truthy(v)) return v as T
  return vs[vs.length - 1] as T
}
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)

export function resolveAssFontName(cap: Dict, preset: Preset): string {
  const raw = String(or(cap.font, preset.font, 'Poppins')).trim()
  if (cap._userFont === true && raw) return raw
  const sample = String(cap._captionSampleText ?? '').trim()
  if (sample) {
    const intl = assFontForCaptionSample(sample, '')
    if (intl && ASS_FONT_FILES.has(intl)) return intl
  }
  const canonical = ASS_FONT_ALIASES[raw] ?? raw
  if (ASS_FONT_FILES.has(canonical)) return canonical
  return 'Poppins ExtraBold'
}

export function hexToAss(hex: string): string {
  const h = String(hex).replace(/^#+/, '')
  if (h.length === 6) {
    const [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((x) => parseInt(x, 16))
    return `&H00${hex2(b!)}${hex2(g!)}${hex2(r!)}&`
  }
  return '&H00FFFFFF&'
}

function assSafeHighlightHex(hex: string): string {
  let h = String(hex).replace(/^#+/, '').toUpperCase()
  if (h.length === 6 && h.slice(4, 6) === '47') h = h.slice(0, 4) + '48'
  return `#${h}`
}

function sentenceBoundary(prev: string | null | undefined): boolean {
  if (!prev) return true
  return /[.!?]["')\]]*$/.test(prev.trim())
}

/** Python str.upper()/lower() ≈ JS for the Latin text captions carry. */
function disp(text: string, caseMode: string, sentenceStart = false): string {
  const t = text.replace(/\{/g, '(').replace(/\}/g, ')')
  if (!t) return t
  if (caseMode === 'upper') return t.toUpperCase()
  const lower = t.toLowerCase()
  return sentenceStart ? lower.slice(0, 1).toUpperCase() + lower.slice(1) : lower
}

/** G3afix: <i>/<b> from manual caption lines (py captions_ass._styled). */
function styledWord(w: AssWord, text: string): string {
  if (!(w.it || w.bo)) return text
  const pre = (w.bo ? '{\\b1}' : '') + (w.it ? '{\\i1}' : '')
  const post = (w.it ? '{\\i0}' : '') + (w.bo ? '{\\b0}' : '')
  return pre + text + post
}

export function dispWordsPy(chunk: readonly AssWord[], caseMode: string, styled = true): string[] {
  let out: string[]
  if (caseMode === 'upper') out = chunk.map((w) => disp(w.w, caseMode))
  else {
    out = []
    let start = true
    for (const w of chunk) {
      out.push(disp(w.w, caseMode, start))
      start = sentenceBoundary(String(w.w ?? ''))
    }
  }
  return styled ? out.map((t, k) => styledWord(chunk[k]!, t)) : out
}

/** G3afix: explicit line breaks of a manual caption line (py forced_breaks). */
export function forcedBreaks(chunk: readonly AssWord[]): number[] {
  const out: number[] = []
  chunk.forEach((w, k) => {
    if (k && w.br) out.push(k)
  })
  return out
}

export function assTs(t: number): string {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${h}:${String(m).padStart(2, '0')}:${pyFixedPad(s, 5, 2)}`
}

function alignmentFor(position: string): number {
  return ({ bottom: 2, middle: 5, top: 8 } as Record<string, number>)[position] ?? 2
}

function chunkWords(words: readonly AssWord[], wpl: number): AssWord[][] {
  const out: AssWord[][] = []
  let cur: AssWord[] = []
  if (words.length && words.every((w) => w.ln !== undefined)) {
    // G3a: manual caption lines (py chunk_words) — wordsPerLine ignored.
    for (const w of words) {
      if (cur.length && cur[cur.length - 1]!.ln !== w.ln) {
        out.push(cur)
        cur = []
      }
      cur.push(w)
    }
    if (cur.length) out.push(cur)
    return out
  }
  for (const w of words) {
    if (cur.length && cur.length >= wpl) {
      out.push(cur)
      cur = []
    }
    cur.push(w)
  }
  if (cur.length) out.push(cur)
  return out
}

function activeColor(preset: Preset, spk: number, colors: Dict | null): string {
  if (colors) {
    const key = spk === 0 ? 'a' : 'b'
    if (truthy(colors[key])) return hexToAss(String(colors[key]))
  }
  return hexToAss(spk === 0 ? preset.active : preset.activeB)
}

function capStyleColors(preset: Preset): [string, string, number] {
  if (preset.slug === 'boxed') return [hexToAss('#FFFFFF'), hexToAss('#000000'), 4]
  return [hexToAss(preset.primary), hexToAss(preset.outline), pyInt(pyFloat(preset.outlineW ?? 4))]
}

function inactiveInline(preset: Preset): string {
  const [pri, out, ow] = capStyleColors(preset)
  return `{\\1c${pri}\\3c${out}\\bord${ow}\\shad0}`
}

function luminanceHex(hex: string): number {
  const h = hex.replace(/^#+/, '')
  if (h.length !== 6) return 0.5
  const [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((x) => parseInt(x, 16) / 255)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

const contrastAssText = (hl: string) => hexToAss(luminanceHex(hl) > 0.5 ? '#000000' : '#FFFFFF')

export function joinCaptionParts(parts: readonly string[], breaks: readonly number[]): string {
  if (!breaks.length) return parts.join(' ')
  const brk = new Set(breaks)
  let out = ''
  parts.forEach((p, i) => {
    if (i === 0) out = p
    else if (brk.has(i)) out += '\\N' + p
    else out += ' ' + p
  })
  return out
}

export function applyLineScale(text: string, scale: number): string {
  if (scale >= 0.999) return text
  const pct = roundHalfUp(100 * scale)
  return `{\\fscx${pct}\\fscy${pct}}` + text.replace(/\\fsc([xy])(\d+(?:\.\d+)?)/g, (_m, ax: string, v: string) => `\\fsc${ax}${roundHalfUp(parseFloat(v) * scale)}`)
}

function fullLineBoxLayerText(cased: string[], activeKi: number, fillHex: string, breaks: number[], border = 22): string {
  const bc = hexToAss(assSafeHighlightHex(fillHex))
  const parts = cased.map((word, xi) =>
    xi === activeKi
      ? `{\\1c&H000000&\\3c${bc}\\3a&H00&\\bord${border}}${word}`
      : `{\\1c&H000000&\\3c&H00000000&\\3a&HFF&\\bord0}${word}`,
  )
  return joinCaptionParts(parts, breaks)
}

const CP_STALE_KEYS = ['presetConfig', 'colors', 'animation', 'case', 'wordsPerLine', 'size', 'sizePct', 'font', 'activeStyle', 'highlightColor']

function cpLineBgText(cased: string[], box: Dict, breaks: number[]): string {
  let h = String(or(box.color, '#000000')).replace(/^#+/, '')
  h = h.length === 6 ? h : '000000'
  const color = `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase()
  const opacity = pyFloat(box.opacity !== undefined && box.opacity !== null ? box.opacity : 0.6)
  const alpha = Math.max(0, Math.min(255, pyInt(pyRound((1.0 - opacity) * 255))))
  const pad = pyInt(pyFloat(or(box.padX, 14)))
  return `{\\1a&HFF&\\3c${color}\\3a&H${hex2(alpha)}&\\bord${pad}\\shad0}` + joinCaptionParts(cased, breaks)
}

/** caption_presets.resolve_preset (unknown → bold_pop). */
function resolveLegacyPreset(id: unknown): Preset {
  const key = String(or(id, 'bold_pop')).replace(/-/g, '_')
  return structuredClone((LEGACY_PRESETS[key] ?? LEGACY_PRESETS.bold_pop) as unknown as Preset)
}

/** t6_captions.map_v2_to_legacy_ass_preset (Python semantics: int() truncation, no stomp remap). */
function mapV2ToLegacy(p: Dict): Preset {
  const g = (o: unknown, k: string): unknown => (isDict(o) ? o[k] : undefined)
  const box = p.box
  return {
    slug: or(p.id, 'cp1'),
    name: or(p.name, 'CP'),
    font: or(p.font, 'Montserrat'),
    weight: pyInt(pyFloat(or(p.weight, 800))),
    case: or(p.case, 'upper'),
    wordsPerLine: pyInt(pyFloat(or(p.wordsPerChunk, 3))),
    sizePct: (pyFloat(or(p.sizePx1920, 80)) / 1920) * 100,
    position: 'bottom',
    marginVPct: pyInt((1 - pyFloat(or(g(p.position, 'y'), 0.65))) * 100),
    primary: or(p.fill, '#FFFFFF'),
    active: or(g(p.highlight, 'color'), '#FFD93D'),
    activeB: or(g(p.highlight, 'altColor'), '#39FF14'),
    outline: or(g(p.stroke, 'color'), '#000000'),
    outlineW: pyInt(pyFloat(or(g(p.stroke, 'px'), 4))),
    shadow: pyInt(pyFloat(or(g(p.shadow, 'px'), 0))),
    box: isDict(box)
      ? { color: box.color, padX: box.padX, padY: box.padY, radius: box.radiusPx, opacity: box.opacity }
      : null,
    animation: or(g(p.animation, 'kind'), 'none'),
    emphasisScale: 1.15,
    highlightMode: or(g(p.highlight, 'mode'), 'color'),
    animationMs: pyInt(pyFloat(or(g(p.animation, 'ms'), 200))),
  } as Preset
}

/** caption_safe_area.caption_min_margin_v_pct (G3a: by frame shape; 9:16 keeps 12 %). */
export function captionMinMarginVPct(playW: number | undefined, playH: number): number {
  if (!playW || !playH) return 12.0
  const r = playW / playH
  if (r >= 1.5) return 6.0
  if (r >= 0.95) return 8.0
  if (r >= 0.75) return 10.0
  return 12.0
}

/** caption_safe_area.clamp_caption_export_style. */
export function clampCaptionExportStyle(cap0: Dict, playH = 1280, playW?: number): Dict {
  const cap: Dict = { ...cap0 }
  const preset = resolveLegacyPreset(or(cap.presetId, cap.preset))
  const minM = captionMinMarginVPct(playW, playH)
  let marginV = pyFloat(or(cap.marginVPct, preset.marginVPct, 12.0))
  marginV = Math.max(minM, marginV)
  let sizePct = pyFloat(or(cap.size, cap.sizePct, preset.sizePct, 6.5))
  sizePct = Math.min(10.5, Math.max(3.0, sizePct))
  const fontsize = (sizePct / 100.0) * playH
  const marginPx = (marginV / 100.0) * playH
  const maxMarginPx = playH * 0.82 - fontsize * 1.45
  if (marginPx > maxMarginPx && maxMarginPx > 0) marginV = Math.max(minM, (maxMarginPx / playH) * 100.0)
  cap.marginVPct = pyRoundN(marginV, 1)
  cap.size = pyRoundN(sizePct, 1)
  cap.position = or(cap.position, preset.position, 'bottom')
  cap._safeAreaOk = true
  return cap
}

type Fit = { font: string; fontsize: number; maxWidthPx: number; outlinePx: number; boxPadPx: number; emphScale: number; highlightMode: string }

function chunkFit(chunk: AssWord[], caseMode: string, fit: Fit, emphasis: Set<number>, anim: string, activeStyle: string): [number[], number] {
  let peak = 1.0
  if (anim === 'pop' || anim === 'bounce' || anim === 'stomp') peak = Math.max(peak, 1.12)
  if (chunk.some((w) => emphasis.has(pyInt(pyFloat(w.i ?? -1))))) peak = Math.max(peak, fit.emphScale || 1.0)
  if (fit.highlightMode === 'supersize') peak = Math.max(peak, 1.25)
  let pad = Math.max(fit.outlinePx || 0, fit.boxPadPx || 0)
  if (activeStyle === 'highlight') pad = Math.max(pad, 22.0)
  const plain = dispWordsPy(chunk, caseMode, false)
  const forced = forcedBreaks(chunk)
  if (forced.length) {
    // G3afix: the cue's own lines are kept; each one only shrinks (never re-wraps) to fit.
    let scale = 1.0
    const starts = [0, ...forced]
    const ends = [...forced, plain.length]
    starts.forEach((a, k) => {
      const r = fitCaptionLine(plain.slice(a, ends[k]), { font: fit.font, fontsize: fit.fontsize || 0, maxWidthPx: fit.maxWidthPx || 0, peakScale: peak, padPx: pad, maxLines: 1 })
      scale = Math.min(scale, r.scale)
    })
    return [forced, scale]
  }
  const r = fitCaptionLine(plain, { font: fit.font, fontsize: fit.fontsize || 0, maxWidthPx: fit.maxWidthPx || 0, peakScale: peak, padPx: pad })
  return [r.breaks, r.scale]
}

function appendCaptionEvents(
  events: string[],
  o: {
    words: AssWord[]; cap: Dict; preset: Preset; anim: string; wpl: number; caseMode: string; colors: Dict | null
    emphasis: Set<number>; emphScale: number; box: Dict | null; playW: number; playH: number; position: string
    highlightMode: string; fit: Fit; motionEdits?: ClipEditsV2 | null; assAlign: number; marginV: number
  },
): void {
  const { words, cap, preset, wpl, caseMode, colors, emphasis, emphScale, box, playW, playH, position, fit } = o
  const motionPrefix = (tSec: number) => {
    if (!o.motionEdits?.keyframes?.length) return ''
    return captionAssMotionTags(captionMotionAt(o.motionEdits, tSec * 1000), playW, playH, o.assAlign, o.marginV)
  }
  let anim = o.anim
  let activeStyle = String(or(cap.activeStyle, '')).toLowerCase()
  if (!['color', 'highlight', 'fill'].includes(activeStyle)) activeStyle = ''
  const highlightMode = String(or(o.highlightMode, preset.highlightMode, 'color')).toLowerCase()
  if (highlightMode === 'box' && !activeStyle) activeStyle = 'highlight'
  if (highlightMode === 'fill' && !activeStyle) activeStyle = 'fill'
  if ((highlightMode === 'karaoke' || highlightMode === 'karaoke_dim') && anim === 'none') anim = highlightMode === 'karaoke' ? 'karaoke' : 'karaoke_dim'
  let highlightHex = String(or(cap.highlightColor, preset.active, '#FDE047'))
  if (!/^#[0-9a-fA-F]{6}$/.test(highlightHex)) highlightHex = '#FDE047'

  const chunks = chunkWords(words, wpl)
  // Python: `cap_out, _, cap_ow = cap_style_colors(preset)` binds the PRIMARY colour (kept for byte parity).
  const [capOut] = capStyleColors(preset)
  const slug = String(or(preset.slug, ''))

  chunks.forEach((chunk, chunkIdx) => {
    if (!chunk.length) return
    const [breaks, lineScale] = chunkFit(chunk, caseMode, fit, emphasis, anim, activeStyle)
    let chunkEnd = pyFloat(chunk[chunk.length - 1]!.e)
    if (chunkIdx + 1 < chunks.length) chunkEnd = Math.min(chunkEnd, pyFloat(chunks[chunkIdx + 1]![0]!.s))

    if (anim === 'slideup') {
      const ws = pyFloat(chunk[0]!.s)
      const cx = Math.floor(playW / 2)
      const y = ({ bottom: pyInt(playH * 0.88), middle: Math.floor(playH / 2), top: pyInt(playH * 0.12) } as Record<string, number>)[position] ?? pyInt(playH * 0.88)
      const move = `{\\move(${cx},${y + pyInt(0.03 * playH)},${cx},${y},0,150)\\fad(150,0)}`
      const line = applyLineScale(joinCaptionParts(dispWordsPy(chunk, caseMode), breaks), lineScale)
      events.push(`Dialogue: 1,${assTs(ws)},${assTs(chunkEnd)},Cap,,0,0,0,,${motionPrefix(ws)}${move}${line}`)
      return
    }
    if (anim === 'karaoke' || activeStyle === 'fill') {
      const ws = pyFloat(chunk[0]!.s)
      const cased = dispWordsPy(chunk, caseMode)
      const parts = chunk.map((w, k) => `{\\kf${Math.max(1, pyInt((pyFloat(w.e) - pyFloat(w.s)) * 100))}}${cased[k]}`)
      const sec = hexToAss(preset.primary)
      const spk = chunk.length ? pyInt(pyFloat(chunk[0]!.spk ?? 0)) : 0
      const pri = activeStyle === 'fill' ? hexToAss(highlightHex) : activeColor(preset, spk, colors)
      events.push(
        `Dialogue: 1,${assTs(ws)},${assTs(chunkEnd)},Cap,,0,0,0,,${motionPrefix(ws)}` +
          applyLineScale(`{\\1c${pri}\\3c${capOut}\\2c${sec}}` + joinCaptionParts(parts, breaks), lineScale),
      )
      return
    }
    if (anim === 'karaoke_dim' || highlightMode === 'karaoke_dim') {
      const ws = pyFloat(chunk[0]!.s)
      const dim = hexToAss(String(or(preset.primary, '#808080')))
      const cased = dispWordsPy(chunk, caseMode)
      const parts = chunk.map((w, k) => `{\\kf${Math.max(1, pyInt((pyFloat(w.e) - pyFloat(w.s)) * 100))}}${cased[k]}`)
      const spk = chunk.length ? pyInt(pyFloat(chunk[0]!.spk ?? 0)) : 0
      const pri = activeColor(preset, spk, colors)
      events.push(
        `Dialogue: 1,${assTs(ws)},${assTs(chunkEnd)},Cap,,0,0,0,,${motionPrefix(ws)}` +
          applyLineScale(`{\\1c${pri}\\3c${capOut}\\2c${dim}\\alpha&H40&}` + joinCaptionParts(parts, breaks), lineScale),
      )
      return
    }
    if (anim === 'typewriter') {
      const cased = dispWordsPy(chunk, caseMode)
      chunk.forEach((w, wi) => {
        const wStart = pyFloat(w.s)
        const wEnd = wi + 1 < chunk.length ? pyFloat(chunk[wi + 1]!.s) : chunkEnd
        const text = cased[wi]!
        const durMs = Math.max(1, pyInt((pyFloat(w.e) - pyFloat(w.s)) * 1000))
        const chars = [...text]
        const step = Math.max(1, Math.floor(durMs / Math.max(1, chars.length)))
        let built = ''
        chars.forEach((ch, ci) => {
          const off0 = ci * step
          const off1 = Math.min(durMs, off0 + step)
          built += `{\\alpha&HFF&\\t(${off0},${off1},\\alpha&H00&)}${ch}`
        })
        const col = activeColor(preset, pyInt(pyFloat(w.spk ?? 0)), colors)
        events.push(`Dialogue: 1,${assTs(wStart)},${assTs(wEnd)},Cap,,0,0,0,,${motionPrefix(wStart)}{\\c${col}}${built}`)
      })
      return
    }
    chunk.forEach((w, ki) => {
      const wStart = pyFloat(w.s)
      const wEnd = ki + 1 < chunk.length ? pyFloat(chunk[ki + 1]!.s) : chunkEnd
      if (wEnd <= wStart) return
      const spk = pyInt(pyFloat(w.spk ?? 0))
      const col = activeColor(preset, spk, colors)
      const wi = pyInt(pyFloat(w.i ?? ki))
      const isEmph = emphasis.has(wi)
      const useBoxLayer = Boolean(box) && (slug === 'boxed' || (slug === 'highlighter' && isEmph) || highlightMode === 'box')
      const useFullLineBox = useBoxLayer || activeStyle === 'highlight'
      const boxFill = activeStyle === 'highlight' ? highlightHex : String(box ? (box.color ?? '#FDE047') : '#FDE047')
      const cased = dispWordsPy(chunk, caseMode)
      const contrast = contrastAssText(activeStyle === 'highlight' ? highlightHex : '#FDE047')
      const parts: string[] = []
      chunk.forEach((x, xi) => {
        const word = cased[xi]!
        if (x === w) {
          const tags: string[] = []
          if (useFullLineBox && activeStyle === 'highlight') {
            tags.push(`\\c${contrast}`)
            if (box && slug.startsWith('cp')) tags.push('\\bord0')
          } else if (useBoxLayer && !useFullLineBox) {
            tags.push('\\1c&H000000&')
          } else tags.push(`\\c${col}`)
          const a = !(slug === 'highlighter' && !isEmph) ? anim : isEmph ? 'pop' : 'none'
          if (a === 'pop') tags.push(POP_TAG)
          else if (a === 'bounce') tags.push(BOUNCE_TAG)
          else if (a === 'glow') tags.push(GLOW_TAG_INNER)
          if (highlightMode === 'underline') tags.push('\\u1')
          if (highlightMode === 'supersize') tags.push('\\fscx125\\fscy125')
          if (isEmph && !useBoxLayer) {
            const sc = pyInt(emphScale * 100)
            tags.push(`\\fscx${sc}\\fscy${sc}`)
          }
          parts.push('{' + tags.join('') + '}' + word)
        } else {
          let inactive = inactiveInline(preset)
          if (highlightMode === 'karaoke_dim') inactive = `{\\alpha&H60&}${inactive}`
          parts.push(inactive + word)
        }
      })
      const line = applyLineScale(joinCaptionParts(parts, breaks), lineScale)
      const cpBg = Boolean(box) && slug.startsWith('cp')
      if (cpBg) events.push(`Dialogue: 0,${assTs(wStart)},${assTs(wEnd)},Box,,0,0,0,,` + applyLineScale(cpLineBgText(cased, box!, breaks), lineScale))
      if (useFullLineBox) events.push(`Dialogue: ${cpBg ? 1 : 0},${assTs(wStart)},${assTs(wEnd)},Box,,0,0,0,,` + applyLineScale(fullLineBoxLayerText(cased, ki, boxFill, breaks), lineScale))
      events.push(`Dialogue: ${cpBg ? 2 : 1},${assTs(wStart)},${assTs(wEnd)},Cap,,0,0,0,,${motionPrefix(wStart)}${line}`)
    })
  })
}

/** captions_ass.build_ass → the .ass text (Python writes header + "\n".join(events) + "\n"). */
export function buildCaptionsAss(
  words: readonly AssWord[],
  editsCaptions: Dict | null | undefined,
  playW = 720,
  playH = 1280,
  motionEdits: ClipEditsV2 | null = null,
): string {
  let cap = clampCaptionExportStyle(isDict(editsCaptions) ? editsCaptions : {}, playH, playW)
  const captionSample = words
    .map((w) => w.w)
    .join(' ')
    .slice(0, 400)
  if (captionSample) cap = { ...cap, _captionSampleText: captionSample }
  const presetId = String(or(cap.presetId, cap.preset, 'bold_pop'))
  const isCp = presetId.startsWith('cp')
  if (isCp) cap = Object.fromEntries(Object.entries(cap).filter(([k]) => !CP_STALE_KEYS.includes(k)))
  let preset: Preset
  if (isCp) {
    const v2 = (CAPTION_PRESETS_V2[presetId] ?? CAPTION_PRESETS_V2.cp1 ?? {}) as Dict
    preset = structuredClone(mapV2ToLegacy({ ...v2, id: presetId }))
  } else preset = resolveLegacyPreset(presetId)
  const inline = cap.presetConfig
  if (isDict(inline) && Object.keys(inline).length && !isCp) {
    for (const [k, v] of Object.entries(inline)) if (v !== null && v !== undefined) (preset as Dict)[k] = v
  }
  if (truthy(cap.font)) preset.font = cap.font as string
  const anim = String(or(cap.animation, preset.animation, 'none')).toLowerCase()
  const highlightMode = String(or(preset.highlightMode, cap.highlightMode, 'color')).toLowerCase()
  const wpl = pyInt(pyFloat(or(cap.wordsPerLine, preset.wordsPerLine, 2)))
  let caseMode = String(or(cap.case, preset.case, 'upper')).toLowerCase()
  caseMode = caseMode === 'upper' ? 'upper' : 'sentence'
  let sizePct = pyFloat(or(isCp ? cap.userSizePct : cap.size, isCp ? undefined : cap.sizePct, preset.sizePct))
  if (sizePct < 3) sizePct = pyFloat(preset.sizePct)
  sizePct = Math.max(3.0, Math.min(12.0, sizePct))
  let fontsize = pyRound((sizePct / 100) * playH)
  const specFs = cap._composeSpecAssFontsize
  if (specFs !== undefined && specFs !== null) fontsize = pyInt(pyFloat(specFs))
  const position = String(or(cap.position, preset.position))
  let marginV = pyRound((playH * pyFloat(or(cap.marginVPct, preset.marginVPct))) / 100)
  if (cap._assMarginV !== undefined && cap._assMarginV !== null) marginV = pyInt(pyFloat(cap._assMarginV))
  let assAlign = alignmentFor(position)
  if (cap._assAlignment !== undefined && cap._assAlignment !== null) assAlign = pyInt(pyFloat(cap._assAlignment))
  let maxLineW: number | null = null
  let marginLr: number
  if (cap._composeSpecMaxLineWidthPx !== undefined && cap._composeSpecMaxLineWidthPx !== null) {
    maxLineW = pyInt(pyFloat(cap._composeSpecMaxLineWidthPx))
    marginLr = Math.max(0, Math.floor((playW - maxLineW) / 2))
  } else marginLr = Math.max(54, pyRound(playW * 0.05))
  const colors = isDict(cap.colors) ? cap.colors : null
  const emphasis = new Set(((cap.emphasis as unknown[]) || []).filter((x): x is number => typeof x === 'number'))
  const emphScale = pyFloat(or(preset.emphasisScale, 1.15))
  const box = (preset.box as Dict | null | undefined) ?? null

  const [capPri, capOut, capOw] = capStyleColors(preset)
  const boxPri = hexToAss('#000000')
  const boxOutline = box ? hexToAss(String(box.color)) : capOut
  const boxPad = box ? pyInt(pyFloat(box.padX ?? 8)) : capOw
  const fontName = resolveAssFontName(cap, preset)
  const ref = fitReferenceFrame(playW, playH)
  const fit: Fit = {
    font: fontName,
    fontsize: specFs !== undefined && specFs !== null ? roundHalfUp(pyInt(pyFloat(specFs)) * ref.k) : roundHalfUp((sizePct / 100) * ref.h),
    maxWidthPx: maxLineW !== null ? roundHalfUp(maxLineW * ref.k) : captionSafeWidthPx(ref.w),
    outlinePx: capOw || 0,
    boxPadPx: box ? boxPad || 0 : 0,
    emphScale,
    highlightMode,
  }
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playW}
PlayResY: ${playH}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${fontName},${fontsize},${capPri},${capPri},${capOut},&H99000000,0,0,0,0,100,100,0,0,1,${capOw},0,${assAlign},${marginLr},${marginLr},${marginV},1
Style: Box,${fontName},${fontsize},${boxPri},${boxPri},${boxOutline},&H99000000,0,0,0,0,100,100,0,0,3,${boxPad},0,${assAlign},${marginLr},${marginLr},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const ws = words.map((w) => ({ ...w }))
  const events: string[] = []
  const run = (c: Dict) =>
    appendCaptionEvents(events, {
      words: ws,
      cap: c,
      preset,
      anim,
      wpl,
      caseMode,
      colors,
      emphasis,
      emphScale,
      box,
      playW,
      playH,
      position,
      highlightMode,
      fit,
      motionEdits,
      assAlign,
      marginV,
    })
  try {
    run(cap)
  } catch {
    const fb = { ...cap }
    delete fb.activeStyle
    delete fb.highlightColor
    events.length = 0
    run(fb)
  }
  return header + events.join('\n') + '\n'
}
