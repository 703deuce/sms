/**
 * E3fix2: caption line breaking shared by the editor preview and the burned-in export.
 *
 * 1:1 mirror of worker/clips_worker/caption_fit.py + the fit inputs captions_ass.build_ass derives
 * (parity fixture: worker/tests/fixtures/caption_fit_parity.json, asserted by both sides).
 * Breaks are decided in a reference frame (1080 px short side, same aspect) so 720p / 1080p exports
 * and the preview break a chunk at the same words. Metrics: caption-fit-metrics.json (byte-identical
 * to worker/clips_worker/caption_font_metrics.json; worker/scripts/gen_caption_fit_metrics.py).
 */
import METRICS from '@/lib/clips/caption-fit-metrics.json'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import { exportPixelSize } from '@/lib/clips/export-aspect'
import { resolvePreset } from '@/lib/clips/caption-presets'
import { effectiveCaptionEdits, resolveT6CaptionPreset } from '@/lib/clips/caption-v2-bridge'

type FontRow = { unitsPerEm: number; assEmPerFontsize: number; defaultAdv: number; adv: Record<string, number> }
const ALL = METRICS as Record<string, FontRow>

export const FIT_REF_SHORT_PX = 1080
const SLACK = 0.97
const EMOJI_ADV_EM = 1.25
const FALLBACK_FONT = 'Montserrat Black'
const SAFE_MARGIN_MIN_PX = 54
const SAFE_MARGIN_FRAC = 0.05

/** Mirror of captions_ass._ASS_FONT_ALIASES → the libass face name (unknown → Poppins ExtraBold). */
const ASS_FONT_ALIASES: Record<string, string> = {
  Poppins: 'Poppins ExtraBold',
  'Poppins ExtraBold': 'Poppins ExtraBold',
  Anton: 'Anton',
  'Montserrat Black': 'Montserrat Black',
  Montserrat: 'Montserrat Black',
  Bangers: 'Bangers',
  Inter: 'Inter',
  Lato: 'Lato',
  'Bebas Neue': 'Bebas Neue',
  'Luckiest Guy': 'Luckiest Guy',
  'Archivo Black': 'Archivo Black',
  Oswald: 'Oswald',
}

export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5)
}

export function assFontName(raw: string | undefined | null): string {
  const name = String(raw ?? '').trim() || 'Poppins'
  return ASS_FONT_ALIASES[name] ?? 'Poppins ExtraBold'
}

function metricsFor(font: string | undefined | null): FontRow | undefined {
  const n = String(font ?? '')
  const alias = n === 'Montserrat' ? 'Montserrat Black' : n === 'Poppins' ? 'Poppins ExtraBold' : n
  return ALL[alias] ?? ALL[FALLBACK_FONT]
}

/** libass em px per ASS Fontsize for a caption font (preview font-size parity). */
export function assEmPerFontsize(font: string | undefined | null): number {
  return metricsFor(assFontName(font))?.assEmPerFontsize ?? 0.714286
}

function isEmoji(cp: number): boolean {
  return (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf)
}

export function textWidthPx(text: string, font: string | undefined | null, fontsize: number): number {
  const m = metricsFor(font)
  if (!m) return [...text].length * fontsize * 0.62
  const upm = m.unitsPerEm
  let units = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    units += isEmoji(cp) ? EMOJI_ADV_EM * upm : (m.adv[String(cp)] ?? m.defaultAdv)
  }
  return (units / upm) * fontsize * m.assEmPerFontsize
}

export type LineFit = { breaks: number[]; scale: number }

export function fitCaptionLine(
  words: readonly string[],
  o: { font: string; fontsize: number; maxWidthPx: number; peakScale?: number; padPx?: number; maxLines?: number },
): LineFit {
  const maxLines = o.maxLines ?? 2
  if (!words.length || o.maxWidthPx <= 0 || o.fontsize <= 0) return { breaks: [], scale: 1 }
  const budget = Math.max(1, o.maxWidthPx * SLACK - 2 * (o.padPx ?? 0))
  const peak = Math.max(1, o.peakScale ?? 1)
  const space = textWidthPx(' ', o.font, o.fontsize)
  const w = (i: number) => textWidthPx(words[i]!, o.font, o.fontsize) * peak
  let full = 0
  for (let i = 0; i < words.length; i++) full += w(i)
  full += space * peak * (words.length - 1)
  if (full <= budget) return { breaks: [], scale: 1 }
  const breaks: number[] = []
  const widths: number[] = []
  let lineW = 0
  for (let i = 0; i < words.length; i++) {
    const wi = w(i)
    if (i === 0) {
      lineW = wi
      continue
    }
    const trial = lineW + space * peak + wi
    if (trial > budget && breaks.length + 1 < maxLines) {
      breaks.push(i)
      widths.push(lineW)
      lineW = wi
    } else lineW = trial
  }
  widths.push(lineW)
  const widest = Math.max(...widths)
  const scale = widest <= budget ? 1 : Math.max(0.4, budget / widest)
  return { breaks, scale: Math.floor(scale * 1000 + 0.5) / 1000 }
}

export function fitReferenceFrame(playW: number, playH: number): { w: number; h: number; k: number } {
  const k = FIT_REF_SHORT_PX / Math.max(1, Math.min(playW, playH))
  return { w: roundHalfUp(playW * k), h: roundHalfUp(playH * k), k }
}

export function captionSafeWidthPx(playW: number): number {
  const margin = Math.max(SAFE_MARGIN_MIN_PX, roundHalfUp(playW * SAFE_MARGIN_FRAC))
  return Math.max(1, playW - 2 * margin)
}

/** Python round(x, 1) (half-to-even on exact binary ties, e.g. 7.25 → 7.2). */
function pyRound1(x: number): number {
  const t = x * 10
  const f = Math.floor(t)
  if (t - f === 0.5 && Number.isInteger(x * 20)) return (f % 2 === 0 ? f : f + 1) / 10
  return Math.round(t) / 10
}

type PresetLike = {
  slug?: string
  font?: string
  case?: string
  wordsPerLine?: number
  sizePct?: number
  outlineW?: number
  box?: { padX?: number } | null
  animation?: string
  emphasisScale?: number
  highlightMode?: string
}
type CapLike = {
  presetId?: string | null
  font?: string
  size?: number
  sizePct?: number
  case?: string
  wordsPerLine?: number
  animation?: string
  activeStyle?: string
  highlightMode?: string
}

export type CaptionFitConfig = {
  font: string
  fontsize: number
  maxWidthPx: number
  outlinePx: number
  boxPadPx: number
  emphScale: number
  anim: string
  highlightMode: string
  activeStyle: string
  caseMode: 'upper' | 'sentence'
  wordsPerLine: number
  /** Reference frame height the fontsize is expressed in (fontsize / refH = share of frame height). */
  refH: number
}

/**
 * Mirror of the fit inputs build_ass derives. `cap` = effective captions (effectiveCaptionEdits),
 * `preset` = the resolved preset (resolveT6CaptionPreset: presetConfig merged / CP mapped),
 * `basePresetSizePct` = sizePct of the plain preset by id (worker clamp_caption_export_style),
 * `cpMode` = a self-contained CP preset (its size / font come from the preset only).
 */
export function captionFitConfig(input: {
  cap: CapLike
  preset: PresetLike
  basePresetSizePct?: number
  cpMode: boolean
  aspect?: ExportAspect
}): CaptionFitConfig {
  const { cap, preset, cpMode } = input
  const { width: pw, height: ph } = exportPixelSize(input.aspect ?? '9:16', '1080p')
  const ref = fitReferenceFrame(pw, ph)
  let sizePct: number
  if (cpMode) {
    sizePct = Number(preset.sizePct)
  } else {
    let s = Number(cap.size || cap.sizePct || input.basePresetSizePct || 6.5)
    s = Math.min(10.5, Math.max(3, s))
    sizePct = pyRound1(s)
  }
  if (!(sizePct >= 3)) sizePct = Number(preset.sizePct)
  sizePct = Math.max(3, Math.min(12, sizePct))
  const box = preset.box ?? null
  const hm = String(preset.highlightMode || cap.highlightMode || 'color').toLowerCase()
  let activeStyle = String(cap.activeStyle || '').toLowerCase()
  if (!['color', 'highlight', 'fill'].includes(activeStyle)) activeStyle = ''
  if (hm === 'box' && !activeStyle) activeStyle = 'highlight'
  if (hm === 'fill' && !activeStyle) activeStyle = 'fill'
  return {
    font: assFontName((cpMode ? undefined : cap.font?.trim()) || preset.font || 'Poppins'),
    fontsize: roundHalfUp((sizePct / 100) * ref.h),
    maxWidthPx: captionSafeWidthPx(ref.w),
    outlinePx: preset.slug === 'boxed' ? 4 : Math.trunc(preset.outlineW ?? 4),
    boxPadPx: box ? Math.trunc(box.padX ?? 8) : 0,
    emphScale: Number(preset.emphasisScale || 1.15),
    anim: String(cap.animation || preset.animation || 'none').toLowerCase(),
    highlightMode: hm,
    activeStyle,
    caseMode: String(cap.case || preset.case || 'upper').toLowerCase() === 'upper' ? 'upper' : 'sentence',
    wordsPerLine: Math.trunc(Number(cap.wordsPerLine || preset.wordsPerLine || 2)),
    refH: ref.h,
  }
}

/** Mirror of captions_ass.disp_words: case per chunk (sentence start resets at each chunk). */
export function dispWords(chunk: readonly { w: string }[], caseMode: 'upper' | 'sentence'): string[] {
  const disp = (text: string, start: boolean) => {
    const t = text.replace(/\{/g, '(').replace(/\}/g, ')')
    if (!t) return t
    if (caseMode === 'upper') return t.toUpperCase()
    const lower = t.toLowerCase()
    return start ? lower.slice(0, 1).toUpperCase() + lower.slice(1) : lower
  }
  let start = true
  return chunk.map((w) => {
    const out = disp(String(w.w ?? ''), caseMode === 'upper' ? false : start)
    const raw = String(w.w ?? '')
    start = !raw || /[.!?]["')\]]*$/.test(raw.trim())
    return out
  })
}

/** Mirror of captions_ass._chunk_fit: breaks / shrink for one caption chunk. */
export function captionChunkFit(
  cfg: CaptionFitConfig,
  chunk: readonly { w: string; i?: number }[],
  emphasis: ReadonlySet<number>,
): LineFit {
  let peak = 1
  if (cfg.anim === 'pop' || cfg.anim === 'bounce' || cfg.anim === 'stomp') peak = Math.max(peak, 1.12)
  if (chunk.some((w) => emphasis.has(Math.trunc(w.i ?? -1)))) peak = Math.max(peak, cfg.emphScale || 1)
  if (cfg.highlightMode === 'supersize') peak = Math.max(peak, 1.25)
  let pad = Math.max(cfg.outlinePx, cfg.boxPadPx)
  if (cfg.activeStyle === 'highlight') pad = Math.max(pad, 22)
  return fitCaptionLine(dispWords(chunk, cfg.caseMode), {
    font: cfg.font,
    fontsize: cfg.fontsize,
    maxWidthPx: cfg.maxWidthPx,
    peakScale: peak,
    padPx: pad,
  })
}

/** Safe-width share of the frame width (preview container max-width, %). */
export function captionSafeWidthPct(aspect: ExportAspect = '9:16'): number {
  const { width, height } = exportPixelSize(aspect, '1080p')
  const ref = fitReferenceFrame(width, height)
  return (captionSafeWidthPx(ref.w) / ref.w) * 100
}

/**
 * Fit config for edits.captions exactly as the export sees them (CP presets stripped / mapped,
 * presetConfig merged, size clamped). Used by the preview overlay and the parity test.
 */
export function captionFitConfigForEdits(
  captions: Parameters<typeof effectiveCaptionEdits>[0] & CapLike,
  t6Caps: boolean,
  aspect: ExportAspect = '9:16',
): CaptionFitConfig {
  const cap = effectiveCaptionEdits(captions ?? {}, t6Caps) as CapLike
  const preset = resolveT6CaptionPreset(captions as Parameters<typeof resolveT6CaptionPreset>[0], t6Caps) as PresetLike
  const id = String(captions?.presetId ?? '').trim() || 'bold_pop'
  return captionFitConfig({
    cap,
    preset,
    basePresetSizePct: resolvePreset(id).sizePct,
    cpMode: t6Caps && id.startsWith('cp'),
    aspect,
  })
}

/** Chunk words like captions_ass.chunk_words (fixed wordsPerLine groups). */
export function chunkCaptionWords<T>(words: readonly T[], wpl: number): T[][] {
  const n = Math.max(1, wpl)
  const out: T[][] = []
  for (let i = 0; i < words.length; i += n) out.push(words.slice(i, i + n))
  return out
}
