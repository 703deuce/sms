/**
 * E4 text item preview math (pure). Mirrors worker clips_worker/text_items.py:
 *   anchor (x %, y %) = the CENTRE of the text block → CSS left/top + translate(−50 %, −50 %).
 *     E4fix: align only aligns the lines inside the block (CapCut / Descript); the worker places
 *     \an4 / \an6 at anchor ∓ half the metric block width, so the block stays put in both.
 *   ASS Fontsize = round(v · H / 1920) → CSS font-size = boxH · Fontsize / H · assEmPerFontsize(font)
 *     (libass em per Fontsize, caption-fit metrics — E4fix: was the stale cssEmPerAssFontsize, which
 *     is 1 for Bangers & co., so those previewed ~1.75× too large). One line = Fontsize tall.
 *   box → per-line inline-block: line height + 2·pad, advance + 2·pad (libass BorderStyle 3)
 *   keyframes `text:<id>` (item-local ms) → translate (% of frame) / rotate / scale about the anchor
 */
import { assEmPerFontsize } from '@/lib/clips/caption-fit'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { layerTransformAt } from '@/lib/clips/editor/keyframes'
import { keyframeTransform } from '@/lib/clips/editor/motion-frame'
import { textFont, type TextItem } from '@/lib/clips/editor/text-items'
import { gradientOf, lineHeightMult } from '@/lib/clips/render-plan/text-items-ass'
import { userFontId } from '@/lib/clips/render-plan/text-rich'

export type TextItemFrame = { visible: boolean; transform: string; opacity: number }

export function textItemFrame(edits: ClipEditsV2, item: TextItem, outMs: number): TextItemFrame {
  if (!(outMs >= item.startMs && outMs < item.endMs)) return { visible: false, transform: '', opacity: 0 }
  const t = layerTransformAt(edits, `text:${item.id}`, outMs - item.startMs)
  return { visible: true, transform: keyframeTransform(t), opacity: Math.max(0, Math.min(1, t.opacity / 100)) }
}

function rgba(hex: string, opacityPct: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(100, opacityPct)) / 100})`
}

export const TEXT_REF_H = 1920

/** ASS Fontsize the worker uses at PlayRes height `playH` (text_items._styles_for). */
export function textAssFontsize(size: number, playH = TEXT_REF_H): number {
  return Math.max(1, Math.round((size * playH) / TEXT_REF_H))
}

/** Static CSS for one item at a preview box height (px). */
export function textItemCss(item: TextItem, boxH: number) {
  const k = boxH / TEXT_REF_H
  const st = item.style
  // G3b: a workspace font previews under its family (FontFace registered by use-workspace-fonts).
  const userFamily = userFontId(st.font) && st.fontFamily ? st.fontFamily : null
  const font = textFont(st.font)
  const em = assEmPerFontsize(userFamily ?? font.id)
  const linePx = textAssFontsize(st.size) * k
  // G3b: line height multiplies the row pitch (worker text_items: per-line \pos at fontsize · lh).
  const rowPx = linePx * lineHeightMult(st as unknown as Record<string, unknown>)
  const text: Record<string, string | number> = {
    fontSize: linePx * em,
    lineHeight: `${linePx}px`,
    fontWeight: userFamily ? 400 : font.weight,
    color: st.color,
    whiteSpace: 'pre',
    display: 'inline-block',
  }
  if (st.stroke && st.stroke.width > 0) {
    text.WebkitTextStroke = `${2 * st.stroke.width * k}px ${st.stroke.color}`
    text.paintOrder = 'stroke fill'
  }
  if (st.shadow && st.shadow.dist > 0) {
    const d = st.shadow.dist * k
    text.textShadow = `${d}px ${d}px 0 ${rgba(st.shadow.color, st.shadow.opacity)}`
  }
  if (st.letterSpacing) text.letterSpacing = `${st.letterSpacing * k}px`
  const g = gradientOf(st as unknown as Record<string, unknown>)
  const gradient = g
    ? {
        backgroundImage: `linear-gradient(${g.dir === 'h' ? 'to right' : 'to bottom'}, ${g.from}, ${g.to})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }
    : null
  const pad = st.box ? st.box.pad * k : 0
  const box = st.box
    ? { background: rgba(st.box.color, st.box.opacity), padding: `${pad}px`, margin: `${-pad}px 0` }
    : null
  return {
    anchor: { left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)', textAlign: st.align, width: 'max-content' },
    origin: `${item.x}% ${item.y}%`,
    linePx,
    rowPx,
    userFamily,
    text,
    gradient,
    box,
  }
}
