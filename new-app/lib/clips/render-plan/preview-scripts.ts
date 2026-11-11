/**
 * EP2: the .ass scripts the editor preview hands to libass-wasm — built by the SAME TS builders
 * that equal the worker's bytes (Tier A goldens). One script per export burn, in burn order:
 *   captions (edits_render.burn_captions) → hook (hook_overlay) → text items (text_items) →
 *   title/headline + badge text (clip_export_template / stream_frame).
 */
import { buildCaptionsAss, type AssWord } from '@/lib/clips/render-plan/captions-ass'
import { CLIP_FONT_MANIFEST } from '@/lib/clips/font-manifest'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { resolveWordFixText } from '@/lib/clips/edits'
import { hookAssForEdits } from '@/lib/clips/render-plan/hook-ass'
import { buildTextItemsAss } from '@/lib/clips/render-plan/text-items-ass'
import { layerFxOf } from '@/lib/clips/editor/layer-fx'
import { buildTitleAss, templateTitleInput } from '@/lib/clips/render-plan/title-ass'
import { headlineAssContent, type HeadlineAssInput } from '@/lib/clips/render-plan/headline-ass'
import { badgeTextAss, type BadgeTextInput } from '@/lib/clips/render-plan/badge-ass'

type Dict = Record<string, unknown>
type Rect = { x: number; y: number; w: number; h: number }

export type PreviewScriptKey = 'captions' | 'hook' | 'text' | 'top'
/** G1b: a text track under an overlay track — its own libass canvas between the B-roll layers. */
export type UnderScript = { key: string; z: number; ass: string }
export type FxTextScript = { key: string; id: string; z?: number; ass: string }
export type PreviewScripts = Record<PreviewScriptKey, string | null> & { under?: UnderScript[]; fx?: FxTextScript[] }
/** G1b: CSS z-index of B-roll stage pass i (B-roll wrappers + under-text canvases); < captions (25). */
export const UNDER_Z_BASE = 10
export const PREVIEW_SCRIPT_ORDER: PreviewScriptKey[] = ['captions', 'hook', 'text', 'top']

export type PreviewScriptInput = {
  edits: Dict
  words: ReadonlyArray<{ w: string; s: number; e: number; idx?: number; spk?: number; ln?: number; br?: boolean; it?: boolean; bo?: boolean }>
  playW: number
  playH: number
  durationMs: number
  /** T6 template spec (editorTemplateSpec) when template mode is on. */
  t6Spec?: { playW: number; playH: number; titleRect?: Rect | null; captionRect?: Rect | null } | null
  titleStyles?: Record<string, { text?: string; font?: string; bg?: { kind?: string } }>
  formatHeadline?: (s: string) => string
  /** ComposeSpec v1 captions block (EXPORT_COMPOSE_SPEC path). */
  composeCaptions?: { marginVPct?: number; position?: string; maxLineWidthPx?: number; assFontsize?: number } | null
  /** fit_top / stream frame layouts: the worker forces captions bottom, marginVPct 6. */
  streamFrame?: boolean
  /** Stream headline inputs published by ExportTemplateOverlay (play px), non-template only. */
  headline?: Omit<HeadlineAssInput, 'durationMs'> | null
  /** Badge text published by PlatformBadgePreview (play px). */
  badge?: BadgeTextInput | null
  /** E6 hook_duplicate rule (edits_render): the export skips a hook that repeats the captions. */
  hookDuplicatesCaptions?: boolean
  /** G1b: B-roll stage passes (tracks.underPasses) when text sits under an overlay; edits_render
   * burns those text items there and the rest on top. */
  underPasses?: ReadonlyArray<{ kind: 'overlay' | 'text'; trackId: string; ids: string[] }> | null
}

/** edits_render: the caption edits burn_captions receives (T6 rect / stream frame overrides). */
export function exportCaptionEdits(
  cap: Dict,
  o: Pick<PreviewScriptInput, 't6Spec' | 'streamFrame' | 'playH' | 'composeCaptions'>,
): Dict {
  let out: Dict = { ...cap }
  if (o.composeCaptions) {
    const c = o.composeCaptions
    out = { ...out, marginVPct: c.marginVPct, position: c.position, _composeSpecMaxLineWidthPx: c.maxLineWidthPx, _composeSpecAssFontsize: c.assFontsize }
  } else if (o.t6Spec) {
    const r = o.t6Spec.captionRect
    if (r) {
      const bottom = Math.trunc(r.y || 0) + Math.trunc(r.h || 0)
      out = { ...out, position: 'bottom', _assAlignment: 2, _assMarginV: Math.max(0, Math.trunc(o.playH) - bottom) }
    }
  } else if (o.streamFrame) {
    out = { ...out, marginVPct: 6, position: 'bottom' }
  }
  if (!out.presetId && !out.preset) out = { ...out, presetId: 'bold_pop', animation: 'pop' }
  return out
}

/** Append script b's styles + events to script a (same PlayRes / WrapStyle; b's styles must not clash). */
export function mergeAss(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  const styles = b.split('\n').filter((l) => l.startsWith('Style: '))
  const events = b.split('\n').filter((l) => l.startsWith('Dialogue: '))
  const i = a.indexOf('\n\n[Events]')
  if (i < 0) return a
  return a.slice(0, i) + (styles.length ? '\n' + styles.join('\n') : '') + a.slice(i).replace(/\n*$/, '\n') + events.join('\n') + '\n'
}

export function buildPreviewScripts(o: PreviewScriptInput): PreviewScripts {
  const e = o.edits
  const tpl = (e.exportTemplate ?? {}) as Dict
  const hb = (tpl.headlineBar ?? {}) as Dict
  const titleText = String(hb.text || tpl.suggestedHeadline || '').trim()
  const t6TitleOn = Boolean(o.t6Spec && hb.enabled && titleText)

  const cap = (e.captions ?? {}) as Dict
  let captions: string | null = null
  if (cap.enabled !== false && o.words.length) {
    const clipEdits = o.edits as ClipEditsV2
    const fixes = clipEdits.wordFixes ?? {}
    const fixMeta = clipEdits.wordFixMeta
    // G3afix: manual caption lines carry `ln` (one caption per line — G3a dropped it here, so the
    // preview re-chunked them by words per line) plus their cue breaks and <i>/<b>.
    const words: AssWord[] = o.words.map((w, i) => {
      const idx = w.idx ?? i
      const clipWord = {
        w: String(w.w ?? ''),
        s: w.s,
        e: w.e,
        i: idx,
        idx,
      }
      const fixed = resolveWordFixText(clipWord, fixes, fixMeta)
      const a: AssWord = { w: fixed, s: w.s, e: w.e, i: idx, spk: w.spk ?? 0 }
      if (typeof w.ln === 'number') a.ln = w.ln
      if (w.br) a.br = true
      if (w.it) a.it = true
      if (w.bo) a.bo = true
      return a
    })
    captions = buildCaptionsAss(words, exportCaptionEdits(cap, o), o.playW, o.playH, o.edits as ClipEditsV2)
  }
  // edits_render: the T6 title already shows the hook line → no hook burn.
  // E6: …and none when the hook repeats the opening captions (hook_text_duplicates_captions).
  const hook = t6TitleOn || o.hookDuplicatesCaptions ? null : hookAssForEdits(e, o.playW, o.playH)
  const passes = o.underPasses ?? []
  const underIds = new Set(passes.filter((p) => p.kind === 'text').flatMap((p) => p.ids))
  const items = Array.isArray(e.textItems) ? (e.textItems as Dict[]) : []
  const fxIds = items
    .map((t) => String(t.id))
    .filter((id) => {
      const fx = layerFxOf(e as never, `text:${id}`)
      return Boolean(fx?.mask || fx?.blend)
    })
  const fxSet = new Set(fxIds)
  const pick = (keep: (id: string) => boolean): Dict => {
    const kept = items.filter((t) => keep(String(t.id)))
    return { ...e, textItems: kept.length ? kept : null }
  }
  const text = buildTextItemsAss(
    fxSet.size || underIds.size ? pick((id) => !underIds.has(id) && !fxSet.has(id)) : e,
    o.playW,
    o.playH,
  )
  const under: UnderScript[] = []
  passes.forEach((p, i) => {
    if (p.kind !== 'text') return
    const ids = new Set(p.ids)
    const ass = buildTextItemsAss(pick((id) => ids.has(id) && !fxSet.has(id)), o.playW, o.playH)
    if (ass) under.push({ key: `under:${p.trackId}`, z: UNDER_Z_BASE + i, ass })
  })
  const fx: FxTextScript[] = []
  for (const id of fxIds) {
    const ass = buildTextItemsAss(pick((x) => x === id), o.playW, o.playH)
    if (!ass) continue
    const uz =
      passes.find((p) => p.kind === 'text' && p.ids.includes(id)) != null
        ? UNDER_Z_BASE + passes.findIndex((p) => p.kind === 'text' && p.ids.includes(id))
        : 25
    fx.push({ key: `fx:${id}`, id, z: uz, ass })
  }

  let top: string | null = null
  if (t6TitleOn && o.t6Spec && o.titleStyles && o.formatHeadline) {
    const input = templateTitleInput(o.t6Spec, titleText, (tpl.headlineStyle ?? null) as never, o.titleStyles, o.formatHeadline)
    if (input) top = buildTitleAss({ ...input, durationMs: o.durationMs })
  } else if (o.headline) {
    top = headlineAssContent({ ...o.headline, durationMs: o.durationMs })
  }
  if (o.badge) {
    const sx = o.t6Spec?.playW ?? o.playW
    const sy = o.t6Spec?.playH ?? o.playH
    // The badge sprite is laid out in a 1080×1920 space by the preview; rescale into the top script.
    const k = sy / o.badge.playH
    const b: BadgeTextInput =
      top && (o.badge.playW !== sx || o.badge.playH !== sy)
        ? { ...o.badge, rect: { x: o.badge.rect.x * k, y: o.badge.rect.y * k, w: o.badge.rect.w * k, h: o.badge.rect.h * k }, playW: sx, playH: sy }
        : o.badge
    top = mergeAss(top, badgeTextAss(b, o.durationMs))
  }
  const base = { captions, hook, text, top }
  if (under.length && fx.length) return { ...base, under, fx }
  if (under.length) return { ...base, under }
  if (fx.length) return { ...base, fx }
  return base
}

/** Family names (Style Fontname + \fn overrides) used by a script. */
export function assFontFamilies(ass: string): string[] {
  const out = new Set<string>()
  for (const l of ass.split('\n')) if (l.startsWith('Style: ')) out.add(l.slice(7).split(',')[1]!.trim())
  for (const m of ass.matchAll(/\\fn([^\\}]+)/g)) out.add(m[1]!.trim())
  return [...out]
}

/** Canonical family → the pinned file under /fonts/clip (same bytes as the worker's). */
export const CLIP_FONT_FILES: Record<string, string> = Object.fromEntries([
  ...CLIP_FONT_MANIFEST.flatMap(row => [
    [row.id.toLowerCase(), row.browserFile.split('/').at(-1)!],
    [row.assFamily.toLowerCase(), row.browserFile.split('/').at(-1)!],
  ]),
  // Retain historical aliases for existing serialized documents and libass.
  ['montserrat black', 'Montserrat-Black.ttf'],
  ['poppins extrabold', 'Poppins-ExtraBold.ttf'],
  ['lato black', 'Lato.ttf'],
])

/** G3b: workspace fonts (family, lower-case → same-origin file URL) — use-workspace-fonts fills it. */
const USER_FONT_URLS = new Map<string, string>()
export function registerUserFontUrl(family: string, url: string): void {
  if (family && !CLIP_FONT_FILES[family.toLowerCase()]) USER_FONT_URLS.set(family.toLowerCase(), url)
}

export function fontUrlsForAss(ass: string, base = '/fonts/clip/'): string[] {
  const files = new Set<string>()
  for (const f of assFontFamilies(ass)) {
    const file = CLIP_FONT_FILES[f.toLowerCase()]
    if (file) files.add(base + file)
    else {
      const user = USER_FONT_URLS.get(f.toLowerCase())
      if (user) files.add(user)
    }
  }
  return [...files]
}
