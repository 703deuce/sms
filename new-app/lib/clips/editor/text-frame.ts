/**
 * E4 text item preview math (pure). Mirrors worker clips_worker/text_items.py:
 *   anchor (x %, y %) + \an4/5/6 → CSS left/top + translate(0 | −50 % | −100 %, −50 %)
 *   ASS px = v · H / 1920 → CSS px = v · boxH / 1920 (× cssEmPerAssFontsize for the font size)
 *   keyframes `text:<id>` (item-local ms) → translate (% of frame) / rotate / scale about the anchor
 */
import { cssEmPerAssFontsize } from '@/lib/clips/caption-fonts'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { layerTransformAt } from '@/lib/clips/editor/keyframes'
import { keyframeTransform } from '@/lib/clips/editor/motion-frame'
import { textFont, type TextItem } from '@/lib/clips/editor/text-items'

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

/** Static CSS for one item at a preview box height (px). */
export function textItemCss(item: TextItem, boxH: number) {
  const k = boxH / 1920
  const st = item.style
  const font = textFont(st.font)
  const em = cssEmPerAssFontsize(font.id === 'Montserrat' ? 'Montserrat Black' : font.id)
  const tx = st.align === 'left' ? '0%' : st.align === 'right' ? '-100%' : '-50%'
  const text: Record<string, string | number> = {
    fontSize: st.size * k * em,
    lineHeight: 1 / em,
    fontWeight: font.weight,
    color: st.color,
    textAlign: st.align,
    whiteSpace: 'pre',
  }
  if (st.stroke && st.stroke.width > 0) {
    text.WebkitTextStroke = `${2 * st.stroke.width * k}px ${st.stroke.color}`
    text.paintOrder = 'stroke fill'
  }
  if (st.shadow && st.shadow.dist > 0) {
    const d = st.shadow.dist * k
    text.textShadow = `${d}px ${d}px 0 ${rgba(st.shadow.color, st.shadow.opacity)}`
  }
  const box = st.box
    ? { background: rgba(st.box.color, st.box.opacity), padding: `${st.box.pad * k}px`, boxDecorationBreak: 'clone' }
    : null
  return {
    anchor: { left: `${item.x}%`, top: `${item.y}%`, transform: `translate(${tx}, -50%)` },
    origin: `${item.x}% ${item.y}%`,
    text,
    box,
  }
}
